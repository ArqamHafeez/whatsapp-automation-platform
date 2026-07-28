import { Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export interface DeliveryJob {
  messageId: string;
  destinationChatId: string;
  ruleId: string;
  connectionId: string;
  body: string | null;
  type: string;
  mediaUrl: string | null;
}

const MEDIA_EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
};

const MEDIA_TYPE_DEFAULT_MIME: Record<string, string> = {
  image: 'image/jpeg',
  video: 'video/mp4',
  document: 'application/pdf',
  audio: 'audio/mpeg',
};

@Injectable()
export class DeliveryService implements OnModuleInit, OnModuleDestroy {
  private sendTimestamps: Map<string, number[]> = new Map();
  private readonly MAX_PER_MINUTE = 30;
  private readonly JITTER_MS = 500;

  // Backoff schedule per spec: 1m -> 5m -> 30m -> 2h, capped at 5 total attempts.
  // Index = (attempts so far) - 1, i.e. delay before the NEXT attempt after this failure.
  private readonly RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];
  private readonly MAX_ATTEMPTS = 5;

  // How often the background poller checks for due retries.
  private readonly RETRY_POLL_INTERVAL_MS = 30_000;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private isPolling = false;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    this.pollTimer = setInterval(() => {
      this.pollDueRetries().catch((err) => {
        console.error('[RETRY POLL ERROR]', err?.message || err);
      });
    }, this.RETRY_POLL_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async enqueueDelivery(job: DeliveryJob) {
    const existing = await this.prisma.sendLog.findUnique({
      where: {
        messageId_destinationChatId: {
          messageId: job.messageId,
          destinationChatId: job.destinationChatId,
        },
      },
    });

    if (existing && existing.status === 'sent') {
      return { skipped: true, reason: 'already_sent' };
    }

    const sendLog = await this.prisma.sendLog.upsert({
      where: {
        messageId_destinationChatId: {
          messageId: job.messageId,
          destinationChatId: job.destinationChatId,
        },
      },
      update: {
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
        status: 'pending',
      },
      create: {
        messageId: job.messageId,
        sourceMessageId: job.messageId,
        destinationChatId: job.destinationChatId,
        ruleId: job.ruleId,
        status: 'pending',
        attempts: 1,
        lastAttemptAt: new Date(),
      },
    });

    await this.processDelivery(sendLog.id, job);
    return { queued: true, sendLogId: sendLog.id };
  }

  private async processDelivery(sendLogId: string, job: DeliveryJob) {
    try {
      await this.enforceRateLimit(job.connectionId);
      await this.sleep(Math.floor(Math.random() * this.JITTER_MS));

      const connection = await this.prisma.whatsAppConnection.findUnique({
        where: { id: job.connectionId },
      });

      if (!connection || connection.status !== 'connected') {
        throw new Error(`Connection not ready: ${connection?.status || 'missing'}`);
      }

      const evolutionUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8081';
      const apiKey = process.env.EVOLUTION_API_KEY || '';
      const number = job.destinationChatId;

      const { path, payload } = this.buildSendRequest(connection.name, number, job);

      console.log(
        `[FORWARD] ${job.messageId} → ${job.destinationChatId} (${job.mediaUrl ? job.type : 'text'}): ${job.body?.substring(0, 50) || ''}`,
      );

      const res = await fetch(`${evolutionUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Evolution send failed (${res.status}): ${errorText}`);
      }

      const result = await res.json();
      console.log(`[FORWARD SUCCESS]`, JSON.stringify(result).substring(0, 200));

      await this.prisma.sendLog.update({
        where: { id: sendLogId },
        data: { status: 'sent', sentAt: new Date(), nextAttemptAt: null },
      });

      return { success: true };
    } catch (err: any) {
      console.error(`[FORWARD FAILED]`, err.message);

      const current = await this.prisma.sendLog.findUnique({ where: { id: sendLogId } });
      const attempts = current?.attempts ?? 1;
      const nextAttemptAt = this.computeNextAttemptAt(attempts);

      await this.prisma.sendLog.update({
        where: { id: sendLogId },
        data: { status: 'failed', errorDetails: err.message, nextAttemptAt },
      });

      return { success: false, error: err.message, willRetryAt: nextAttemptAt };
    }
  }

  /**
   * Builds the Evolution API path + JSON body for a given job. Text-only jobs (or
   * jobs with a recognized type but no mediaUrl) use sendText; jobs with a mediaUrl
   * are routed to sendMedia (image/video/document) or sendWhatsAppAudio (audio),
   * per Evolution API's documented endpoints.
   */
  private buildSendRequest(
    instanceName: string,
    number: string,
    job: DeliveryJob,
  ): { path: string; payload: Record<string, unknown> } {
    if (!job.mediaUrl) {
      return {
        path: `/message/sendText/${instanceName}`,
        payload: { number, text: job.body || '' },
      };
    }

    if (job.type === 'audio') {
      return {
        path: `/message/sendWhatsAppAudio/${instanceName}`,
        payload: { number, audio: job.mediaUrl },
      };
    }

    // image, document, video, or unrecognized-but-has-media -> sendMedia, defaulting
    // unrecognized types to 'document' since that's the safest generic container.
    const mediatype = ['image', 'video', 'document'].includes(job.type) ? job.type : 'document';
    const fileName = this.inferFileName(job.mediaUrl, `file.${this.extensionForMediaType(mediatype)}`);
    const mimetype = this.inferMimetype(mediatype, fileName);

    return {
      path: `/message/sendMedia/${instanceName}`,
      payload: {
        number,
        mediatype,
        mimetype,
        media: job.mediaUrl,
        fileName,
        caption: job.body || undefined,
      },
    };
  }

  private inferFileName(url: string, fallback: string): string {
    try {
      const parsed = new URL(url);
      const base = parsed.pathname.split('/').pop();
      return base && base.length > 0 ? base : fallback;
    } catch {
      return fallback;
    }
  }

  private inferMimetype(mediatype: string, fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext && MEDIA_EXT_MIME[ext]) {
      return MEDIA_EXT_MIME[ext];
    }
    return MEDIA_TYPE_DEFAULT_MIME[mediatype] || 'application/octet-stream';
  }

  private extensionForMediaType(mediatype: string): string {
    if (mediatype === 'image') return 'jpg';
    if (mediatype === 'video') return 'mp4';
    return 'pdf';
  }

  /**
   * Computes when the NEXT attempt should run, given attempts already made
   * (including the one that just failed). Returns null once MAX_ATTEMPTS is
   * reached, meaning: stop retrying automatically.
   */
  private computeNextAttemptAt(attempts: number): Date | null {
    if (attempts >= this.MAX_ATTEMPTS) {
      return null;
    }
    const delay = this.RETRY_DELAYS_MS[attempts - 1] ?? this.RETRY_DELAYS_MS[this.RETRY_DELAYS_MS.length - 1];
    return new Date(Date.now() + delay);
  }

  /**
   * Background poller: picks up failed sends whose nextAttemptAt has passed and
   * retries them. Uses the existing (status, nextAttemptAt) index on SendLog.
   */
  private async pollDueRetries() {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      const due = await this.prisma.sendLog.findMany({
        where: {
          status: 'failed',
          nextAttemptAt: { lte: new Date() },
        },
        take: 20,
      });

      for (const sendLog of due) {
        const message = await this.prisma.message.findUnique({ where: { id: sendLog.messageId } });
        if (!message) {
          // Source message no longer exists — nothing to resend, stop scheduling.
          await this.prisma.sendLog.update({
            where: { id: sendLog.id },
            data: { nextAttemptAt: null },
          });
          continue;
        }

        const job: DeliveryJob = {
          messageId: message.id,
          destinationChatId: sendLog.destinationChatId,
          ruleId: sendLog.ruleId || '',
          connectionId: message.connectionId,
          body: message.body,
          type: message.type,
          mediaUrl: message.mediaUrl,
        };

        await this.prisma.sendLog.update({
          where: { id: sendLog.id },
          data: { attempts: { increment: 1 }, lastAttemptAt: new Date(), status: 'pending' },
        });

        await this.processDelivery(sendLog.id, job);
      }
    } finally {
      this.isPolling = false;
    }
  }

  private async enforceRateLimit(connectionId: string) {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    let timestamps = this.sendTimestamps.get(connectionId) || [];
    timestamps = timestamps.filter((t) => t > oneMinuteAgo);

    if (timestamps.length >= this.MAX_PER_MINUTE) {
      const waitMs = 60000 - (now - timestamps[0]) + 1000;
      await this.sleep(waitMs);
      return this.enforceRateLimit(connectionId);
    }

    timestamps.push(now);
    this.sendTimestamps.set(connectionId, timestamps);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Methods for controller
  async send(body: any) {
    return { message: 'Send endpoint - implement as needed', body };
  }

  /**
   * Manual admin retry: resends immediately without waiting for the backoff
   * schedule, and without re-running the (not-yet-built) AI pipeline — it
   * replays the original message body/media straight to the same destination.
   */
  async retry(sendLogId: string) {
    const sendLog = await this.prisma.sendLog.findUnique({ where: { id: sendLogId } });
    if (!sendLog) {
      throw new NotFoundException('Send log not found');
    }

    const message = await this.prisma.message.findUnique({ where: { id: sendLog.messageId } });
    if (!message) {
      throw new NotFoundException('Source message for this send log no longer exists');
    }

    const job: DeliveryJob = {
      messageId: message.id,
      destinationChatId: sendLog.destinationChatId,
      ruleId: sendLog.ruleId || '',
      connectionId: message.connectionId,
      body: message.body,
      type: message.type,
      mediaUrl: message.mediaUrl,
    };

    await this.prisma.sendLog.update({
      where: { id: sendLog.id },
      data: { attempts: { increment: 1 }, lastAttemptAt: new Date(), status: 'pending' },
    });

    const result = await this.processDelivery(sendLog.id, job);
    return { retried: true, sendLogId: sendLog.id, ...result };
  }

  async getLogs() {
    return this.prisma.sendLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
