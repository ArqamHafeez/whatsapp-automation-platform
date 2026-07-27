import { Injectable } from '@nestjs/common';
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

@Injectable()
export class DeliveryService {
  private sendTimestamps: Map<string, number[]> = new Map();
  private readonly MAX_PER_MINUTE = 30;
  private readonly JITTER_MS = 500;

  constructor(private prisma: PrismaService) {}

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

      // Evolution expects just the number (or full JID). Clean it.
      let number = job.destinationChatId;
      // Keep @g.us for groups, strip @s.whatsapp.net for individuals if needed
      // Most Evolution versions accept full JID or plain number.

      const payload: any = {
        number: number,
        text: job.body || '',
      };

      // If it's an image/document in the future you can extend here
      // For now Phase-1 text only

      console.log(`[FORWARD] ${job.messageId} → ${job.destinationChatId}: ${job.body?.substring(0, 50)}`);

      const res = await fetch(
        `${evolutionUrl}/message/sendText/${connection.name}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': apiKey,
          },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Evolution send failed (${res.status}): ${errorText}`);
      }

      const result = await res.json();
      console.log(`[FORWARD SUCCESS]`, JSON.stringify(result).substring(0, 200));

      await this.prisma.sendLog.update({
        where: { id: sendLogId },
        data: { status: 'sent', sentAt: new Date() },
      });

      return { success: true };
    } catch (err: any) {
      console.error(`[FORWARD FAILED]`, err.message);
      await this.prisma.sendLog.update({
        where: { id: sendLogId },
        data: { status: 'failed', errorDetails: err.message },
      });
      return { success: false, error: err.message };
    }
  }

  private async enforceRateLimit(connectionId: string) {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    let timestamps = this.sendTimestamps.get(connectionId) || [];
    timestamps = timestamps.filter(t => t > oneMinuteAgo);

    if (timestamps.length >= this.MAX_PER_MINUTE) {
      const waitMs = 60000 - (now - timestamps[0]) + 1000;
      await this.sleep(waitMs);
      return this.enforceRateLimit(connectionId);
    }

    timestamps.push(now);
    this.sendTimestamps.set(connectionId, timestamps);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Methods for controller
  async send(body: any) {
    return { message: 'Send endpoint - implement as needed', body };
  }

  async retry(sendLogId: string) {
    return { message: 'Retry endpoint - implement as needed', sendLogId };
  }

  async getLogs() {
    return this.prisma.sendLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
