import { Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { getWahaConfig, wahaHeaders } from '../common/waha/waha.config';
import {
  isDirectHttpMediaUrl,
  isHttpMediaUrl,
  mediaPayloadForWahaSend,
  mimeTypeFromMessageMetadata,
  resolveMediaUrlForForward,
} from '../common/waha/waha-message';
import { isDeliverableWhatsAppJid, toWahaChatId } from '../common/whatsapp/jid-deliverable';
import { chatJidAliases, findAllChatsByInboundJid } from '../common/whatsapp/inbound-chat-jid';
import { whatsAppJidsMatch } from '../common/whatsapp/jid-match';

export interface DeliveryJob {
  messageId: string;
  destinationChatId: string;
  ruleId: string;
  connectionId: string;
  body: string | null;
  type: string;
  mediaUrl: string | null;
  pipelineMode?: 'passthrough' | 'executed' | 'fail_open';
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
  private readonly MAX_PER_MINUTE = Number(process.env.DELIVERY_MAX_PER_MINUTE || 30);
  private readonly JITTER_MS = Number(process.env.DELIVERY_JITTER_MS || 500);

  // Backoff schedule per spec: 1m -> 5m -> 30m -> 2h, capped at 5 total attempts.
  // Index = (attempts so far) - 1, i.e. delay before the NEXT attempt after this failure.
  private readonly RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];
  private readonly MAX_ATTEMPTS = 5;

  // How often the background poller checks for due retries.
  private readonly RETRY_POLL_INTERVAL_MS = 30_000;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private isPolling = false;

  constructor(private prisma: PrismaService) {}

  private async getUserOrgId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.organizationId;
  }

  /**
   * Confirms a SendLog belongs (transitively, via its rule) to the caller's org.
   * If ruleId is missing (schema allows it, though the normal webhook →
   * enqueueDelivery path always sets it), there's no way to verify ownership,
   * so this fails closed rather than risk leaking or mutating another org's send log.
   */
  private async assertSendLogInOrg(ruleId: string | null, orgId: string): Promise<void> {
    if (!ruleId) {
      throw new NotFoundException('Send log not found');
    }
    const rule = await this.prisma.rule.findFirst({ where: { id: ruleId, orgId } });
    if (!rule) {
      throw new NotFoundException('Send log not found');
    }
  }

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
    if (!isDeliverableWhatsAppJid(job.destinationChatId)) {
      console.warn(`[FORWARD SKIP] Invalid destination JID: ${job.destinationChatId}`);
      return { skipped: true, reason: 'invalid_destination_jid' };
    }

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

    const initialStatus = job.pipelineMode === 'fail_open' ? 'forwarded_on_pipeline_error' : 'pending';

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
        status: initialStatus,
      },
      create: {
        messageId: job.messageId,
        sourceMessageId: job.messageId,
        destinationChatId: job.destinationChatId,
        ruleId: job.ruleId,
        status: initialStatus,
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

      const { baseUrl: wahaBaseUrl, apiKey } = getWahaConfig();
      const chatId = toWahaChatId(job.destinationChatId);

      const sessionName = connection.externalId || connection.name;
      const messageRow = await this.prisma.message.findUnique({ where: { id: job.messageId } });
      let mediaUrl = job.mediaUrl;
      if (messageRow && job.type !== 'text' && sessionName) {
        const mimeHint = mimeTypeFromMessageMetadata(messageRow.metadata, job.type);
        const before = mediaUrl;
        mediaUrl = await resolveMediaUrlForForward(
          sessionName,
          job.type,
          job.mediaUrl,
          messageRow.metadata,
          mimeHint,
        );
        if (
          before &&
          isHttpMediaUrl(before) &&
          !isDirectHttpMediaUrl(before) &&
          mediaUrl &&
          mediaUrl !== before
        ) {
          console.log(`[FORWARD MEDIA] Replaced WhatsApp CDN URL with decrypted base64 for ${job.messageId}`);
        }
        if (mediaUrl && mediaUrl !== messageRow.mediaUrl) {
          await this.prisma.message.update({
            where: { id: job.messageId },
            data: { mediaUrl },
          });
        }
      }

      const jobForSend: DeliveryJob = { ...job, mediaUrl };

      const { path, payload } = this.buildSendRequest(sessionName, chatId, jobForSend);

      if (jobForSend.type !== 'text' && !jobForSend.mediaUrl) {
        throw new Error('Media message has no decodable file — caption-only forward skipped');
      }

      console.log(
        `[FORWARD] ${job.messageId} → ${job.destinationChatId} (${jobForSend.mediaUrl ? job.type : 'text'}): ${job.body?.substring(0, 50) || ''}`,
      );

      const res = await fetch(`${wahaBaseUrl}${path}`, {
        method: 'POST',
        headers: wahaHeaders(apiKey),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`WAHA send failed (${res.status}): ${errorText}`);
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
   * Builds WAHA send path + JSON body. Text-only jobs use sendText; media jobs use
   * sendImage / sendVideo / sendFile / sendVoice.
   */
  private buildSendRequest(
    sessionName: string,
    chatId: string,
    job: DeliveryJob,
  ): { path: string; payload: Record<string, unknown> } {
    if (!job.mediaUrl) {
      return {
        path: '/api/sendText',
        payload: { session: sessionName, chatId, text: job.body || '' },
      };
    }

    const fileName = this.inferFileName(job.mediaUrl!, `file.${this.extensionForMediaType(job.type)}`);
    const mimetype = this.inferMimetype(job.type, fileName, job.mediaUrl!);
    const file = this.buildWahaFileField(job.mediaUrl!, mimetype, fileName);

    if (job.type === 'audio') {
      return {
        path: '/api/sendVoice',
        payload: {
          session: sessionName,
          chatId,
          file,
        },
      };
    }

    if (job.type === 'video') {
      return {
        path: '/api/sendVideo',
        payload: {
          session: sessionName,
          chatId,
          file,
          caption: job.body || undefined,
        },
      };
    }

    if (job.type === 'image') {
      return {
        path: '/api/sendImage',
        payload: {
          session: sessionName,
          chatId,
          file,
          caption: job.body || undefined,
        },
      };
    }

    return {
      path: '/api/sendFile',
      payload: {
        session: sessionName,
        chatId,
        file,
        caption: job.body || undefined,
      },
    };
  }

  private buildWahaFileField(
    mediaUrl: string,
    mimetype: string,
    filename: string,
  ): Record<string, unknown> {
    if (isDirectHttpMediaUrl(mediaUrl)) {
      return { mimetype, url: mediaUrl.trim(), filename };
    }
    return {
      mimetype,
      data: mediaPayloadForWahaSend(mediaUrl),
      filename,
    };
  }

  private inferFileName(url: string, fallback: string): string {
    if (url.startsWith('data:')) {
      return fallback;
    }
    try {
      const parsed = new URL(url);
      const base = parsed.pathname.split('/').pop();
      return base && base.length > 0 ? base : fallback;
    } catch {
      return fallback;
    }
  }

  private inferMimetype(mediatype: string, fileName: string, mediaUrl?: string): string {
    if (mediaUrl?.startsWith('data:')) {
      const match = mediaUrl.match(/^data:([^;]+);/i);
      if (match?.[1]) {
        return match[1];
      }
    }
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
  async retry(userId: string, sendLogId: string) {
    const orgId = await this.getUserOrgId(userId);

    const sendLog = await this.prisma.sendLog.findUnique({ where: { id: sendLogId } });
    if (!sendLog) {
      throw new NotFoundException('Send log not found');
    }
    await this.assertSendLogInOrg(sendLog.ruleId, orgId);

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

  async getLogs(userId: string) {
    const orgId = await this.getUserOrgId(userId);

    const connections = await this.prisma.whatsAppConnection.findMany({
      where: { orgId },
      select: { id: true },
    });
    const connectionIds = connections.map((c) => c.id);

    return this.prisma.sendLog.findMany({
      where: {
        OR: [
          { rule: { orgId } },
          ...(connectionIds.length ? [{ message: { connectionId: { in: connectionIds } } }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        message: { select: { body: true, type: true, chatId: true, sender: true } },
        rule: { select: { name: true } },
      },
    });
  }

  async getInboundMessages(userId: string) {
    const orgId = await this.getUserOrgId(userId);

    const connections = await this.prisma.whatsAppConnection.findMany({
      where: { orgId },
      select: { id: true, name: true },
    });
    const connectionIds = connections.map((c) => c.id);
    if (!connectionIds.length) {
      return [];
    }

    const activeRules = await this.prisma.rule.findMany({
      where: { orgId, isActive: true, connectionId: { in: connectionIds } },
      select: { sourceChatIds: true },
    });
    if (!activeRules.length) {
      return [];
    }

    const sourceChatIds = [...new Set(activeRules.flatMap((r) => r.sourceChatIds))];
    if (!sourceChatIds.length) {
      return [];
    }

    const sourceChatIdSet = new Set(sourceChatIds);

    const allChats = await this.prisma.chat.findMany({
      where: { connectionId: { in: connectionIds } },
      select: { id: true, connectionId: true, externalChatId: true, metadata: true },
    });
    if (!allChats.length) {
      return [];
    }

    const expandedSourceChatIds = new Set(sourceChatIds);
    const sourceRows = allChats.filter((c) => sourceChatIdSet.has(c.id));
    for (const source of sourceRows) {
      const sourceAliases = chatJidAliases(source);
      for (const candidate of allChats) {
        if (candidate.connectionId !== source.connectionId) {
          continue;
        }
        const candidateAliases = chatJidAliases(candidate);
        const linked = sourceAliases.some((a) =>
          candidateAliases.some((b) => whatsAppJidsMatch(a, b)),
        );
        if (linked) {
          expandedSourceChatIds.add(candidate.id);
        }
      }
    }

    const pipelineMessageIds = new Set(
      (
        await this.prisma.pipelineDecision.findMany({
          where: { rule: { orgId, isActive: true, connectionId: { in: connectionIds } } },
          select: { messageId: true },
        })
      ).map((row) => row.messageId),
    );

    const isRuleSourceMessage = (connectionId: string, messageChatId: string, messageId: string) => {
      if (pipelineMessageIds.has(messageId)) {
        return true;
      }
      const rows = findAllChatsByInboundJid(
        allChats.filter((c) => c.connectionId === connectionId),
        messageChatId,
      );
      return rows.some((row) => expandedSourceChatIds.has(row.id));
    };

    const messages = await this.prisma.message.findMany({
      where: { connectionId: { in: connectionIds } },
      orderBy: { receivedAt: 'desc' },
      take: 200,
      select: {
        id: true,
        chatId: true,
        sender: true,
        body: true,
        type: true,
        receivedAt: true,
        connectionId: true,
        sendLogs: {
          select: {
            id: true,
            status: true,
            destinationChatId: true,
            rule: { select: { name: true } },
          },
        },
      },
    });

    const connectionNameById = new Map(connections.map((c) => [c.id, c.name]));

    const filtered = messages
      .filter((m) => isRuleSourceMessage(m.connectionId, m.chatId, m.id))
      .slice(0, 50);

    const messageIds = filtered.map((m) => m.id);
    const decisionRows =
      messageIds.length > 0
        ? await this.prisma.pipelineDecision.findMany({
            where: { messageId: { in: messageIds } },
            orderBy: { createdAt: 'desc' },
            include: { rule: { select: { id: true, name: true } } },
          })
        : [];

    const decisionsByMessage = new Map<string, typeof decisionRows>();
    for (const row of decisionRows) {
      const list = decisionsByMessage.get(row.messageId) ?? [];
      list.push(row);
      decisionsByMessage.set(row.messageId, list);
    }

    return filtered.map((m) => ({
      ...m,
      connectionName: connectionNameById.get(m.connectionId) ?? '—',
      forwardCount: m.sendLogs.length,
      pipelineDecisions: decisionsByMessage.get(m.id) ?? [],
    }));
  }
}