import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { getWahaConfig, wahaHeaders } from '../common/waha/waha.config';
import { InboundMessageService } from './inbound-message.service';

const DEFAULT_POLL_MS = 5 * 60_000;

type WahaMessageRow = Record<string, unknown>;

@Injectable()
export class ReconciliationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReconciliationService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly inbound: InboundMessageService,
  ) {}

  onModuleInit() {
    const enabled = process.env.RECONCILIATION_POLL_ENABLED?.trim() !== 'false';
    if (!enabled) {
      this.logger.log('Reconciliation polling disabled (RECONCILIATION_POLL_ENABLED=false)');
      return;
    }
    const intervalMs = Number(process.env.RECONCILIATION_POLL_INTERVAL_MS || DEFAULT_POLL_MS);
    this.timer = setInterval(() => {
      this.poll().catch((err) => {
        this.logger.error(`Reconciliation poll failed: ${(err as Error).message}`);
      });
    }, intervalMs);
    this.logger.log(`Reconciliation polling every ${intervalMs}ms`);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async poll() {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const connections = await this.prisma.whatsAppConnection.findMany({
        where: { status: 'connected', externalId: { not: null } },
        select: { id: true, externalId: true, orgId: true },
      });

      for (const connection of connections) {
        await this.reconcileConnection(connection.externalId!, connection.id);
      }
    } finally {
      this.running = false;
    }
  }

  private async reconcileConnection(sessionName: string, connectionId: string) {
    const sourceChats = await this.prisma.chat.findMany({
      where: { connectionId, isSource: true },
      select: { externalChatId: true },
      take: 50,
    });
    if (!sourceChats.length) {
      return;
    }

    const { baseUrl, apiKey } = getWahaConfig();
    const limit = Number(process.env.RECONCILIATION_MESSAGE_LIMIT || 15);
    let recovered = 0;

    for (const chat of sourceChats) {
      const chatId = encodeURIComponent(chat.externalChatId);
      const url = `${baseUrl}/api/${encodeURIComponent(sessionName)}/chats/${chatId}/messages?limit=${limit}&downloadMedia=false`;
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: wahaHeaders(apiKey),
          signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) {
          continue;
        }
        const body = await res.json();
        const rows: WahaMessageRow[] = Array.isArray(body)
          ? body
          : Array.isArray((body as { messages?: unknown }).messages)
            ? ((body as { messages: WahaMessageRow[] }).messages ?? [])
            : [];

        for (const row of rows) {
          if (row.fromMe) {
            continue;
          }
          const result = await this.inbound.processWahaPayload(
            {
              session: sessionName,
              event: 'message',
              payload: { ...row, fromMe: false },
            },
            { skipFromMe: true },
          );
          if (result.action === 'processed') {
            recovered += 1;
          }
        }
      } catch (err) {
        this.logger.warn(
          `Reconciliation fetch failed session=${sessionName} chat=${chat.externalChatId}: ${(err as Error).message}`,
        );
      }
    }

    if (recovered > 0) {
      this.logger.log(`Reconciliation recovered ${recovered} message(s) for session=${sessionName}`);
    }
  }
}
