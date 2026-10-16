import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { SendStatus } from '@prisma/client';
import { chatJidAliases } from '../common/whatsapp/inbound-chat-jid';
import { isDeliverableWhatsAppJid } from '../common/whatsapp/jid-deliverable';
import { normalizeWhatsAppJid, whatsAppJidsMatch } from '../common/whatsapp/jid-match';
import {
  decodeForwardsCursor,
  encodeForwardsCursor,
  ForwardsCursor,
} from './opportunity-circle-key.util';
import { sanitizeForwardMediaUrl } from './sanitize-forward-media-url';

export type ForwardExportItem = {
  messageId: string;
  forwardId: string;
  sentAt: string;
  category: string | null;
  body: string;
  mediaUrl: string | null;
  ruleId: string | null;
  ruleName: string | null;
  sourceChatTitle: string | null;
  destinationChatTitle: string | null;
};

type SinkChat = { id: string; externalChatId: string; title: string | null; metadata: unknown };

type IntegrationSlice = {
  orgId?: string;
  connectionId: string;
  sinkChatIds: string[];
  primarySinkChatId: string | null;
  categoryByRuleId: unknown;
  defaultCategory: string | null;
};

type SendLogRow = {
  id: string;
  messageId: string;
  destinationChatId: string;
  sentAt: Date | null;
  ruleId: string | null;
  message: {
    chatId: string;
    body: string | null;
    mediaUrl: string | null;
  };
  rule: { id: string; name: string } | null;
};

const RAW_BATCH_SIZE = 150;
const MAX_RAW_SCAN = 2000;

@Injectable()
export class OpportunityCircleForwardsService {
  constructor(private readonly prisma: PrismaService) {}

  private collectDestinationJids(sinkChats: SinkChat[]): string[] {
    const set = new Set<string>();
    for (const chat of sinkChats) {
      for (const jid of chatJidAliases(chat)) {
        if (isDeliverableWhatsAppJid(jid)) {
          set.add(jid.trim());
          set.add(normalizeWhatsAppJid(jid));
        }
      }
      if (chat.externalChatId) {
        set.add(chat.externalChatId.trim());
      }
    }
    return [...set];
  }

  private compareRows(a: { sentAt: Date; messageId: string }, b: { sentAt: Date; messageId: string }): number {
    const ta = a.sentAt.toISOString();
    const tb = b.sentAt.toISOString();
    if (ta !== tb) {
      return ta < tb ? -1 : 1;
    }
    return a.messageId.localeCompare(b.messageId);
  }

  private compareCursor(a: { sentAt: Date; messageId: string }, cursor: ForwardsCursor | null): number {
    if (!cursor) {
      return 1;
    }
    const sentAt = a.sentAt.toISOString();
    if (sentAt > cursor.sentAt) {
      return 1;
    }
    if (sentAt < cursor.sentAt) {
      return -1;
    }
    if (a.messageId > cursor.messageId) {
      return 1;
    }
    if (a.messageId < cursor.messageId) {
      return -1;
    }
    return 0;
  }

  private buildCursorWhere(cursor: ForwardsCursor | null) {
    if (!cursor) {
      return {};
    }
    const sentAt = new Date(cursor.sentAt);
    return {
      OR: [
        { sentAt: { gt: sentAt } },
        {
          AND: [{ sentAt: sentAt }, { messageId: { gt: cursor.messageId } }],
        },
      ],
    };
  }

  private resolveCategory(
    ruleId: string | null | undefined,
    categoryByRuleId: Record<string, string>,
    defaultCategory: string | null | undefined,
  ): string | null {
    if (ruleId && categoryByRuleId[ruleId]) {
      return categoryByRuleId[ruleId];
    }
    return defaultCategory ?? null;
  }

  private preferLog(
    incoming: SendLogRow,
    existing: SendLogRow,
    primaryChat: SinkChat | undefined,
  ): SendLogRow {
    if (!primaryChat) {
      return existing;
    }
    const logIsPrimary = chatJidAliases(primaryChat).some((jid) =>
      whatsAppJidsMatch(jid, incoming.destinationChatId),
    );
    const existingIsPrimary = chatJidAliases(primaryChat).some((jid) =>
      whatsAppJidsMatch(jid, existing.destinationChatId),
    );
    if (logIsPrimary && !existingIsPrimary) {
      return incoming;
    }
    return existing;
  }

  private async loadSinkContext(integration: IntegrationSlice) {
    if (!integration.sinkChatIds.length) {
      return null;
    }
    const sinkChats = await this.prisma.chat.findMany({
      where: {
        connectionId: integration.connectionId,
        id: { in: integration.sinkChatIds },
      },
      select: { id: true, externalChatId: true, title: true, metadata: true },
    });
    const destinationJids = this.collectDestinationJids(sinkChats);
    if (!destinationJids.length) {
      return null;
    }
    const categoryByRuleId =
      integration.categoryByRuleId && typeof integration.categoryByRuleId === 'object'
        ? (integration.categoryByRuleId as Record<string, string>)
        : {};
    const primaryChat = integration.primarySinkChatId
      ? sinkChats.find((c) => c.id === integration.primarySinkChatId)
      : sinkChats[0];

    return { sinkChats, destinationJids, categoryByRuleId, primaryChat };
  }

  private async fetchSendLogBatch(
    integration: IntegrationSlice,
    destinationJids: string[],
    dbCursor: ForwardsCursor | null,
  ): Promise<SendLogRow[]> {
    return this.prisma.sendLog.findMany({
      where: {
        status: SendStatus.sent,
        sentAt: { not: null },
        destinationChatId: { in: destinationJids },
        message: { connectionId: integration.connectionId },
        ...this.buildCursorWhere(dbCursor),
      },
      include: {
        message: { select: { chatId: true, body: true, mediaUrl: true } },
        rule: { select: { id: true, name: true } },
      },
      orderBy: [{ sentAt: 'asc' }, { messageId: 'asc' }],
      take: RAW_BATCH_SIZE,
    });
  }

  private async mapLogsToItems(
    logs: SendLogRow[],
    integration: IntegrationSlice,
    categoryByRuleId: Record<string, string>,
  ): Promise<ForwardExportItem[]> {
    const chats = await this.prisma.chat.findMany({
      where: { connectionId: integration.connectionId },
      select: { externalChatId: true, title: true, metadata: true },
    });

    const findChatTitle = (externalChatId: string) => {
      const row = chats.find((c) => whatsAppJidsMatch(c.externalChatId, externalChatId));
      return row?.title ?? null;
    };

    return logs
      .filter((log) => log.sentAt)
      .map((log) => ({
        messageId: log.messageId,
        forwardId: log.id,
        sentAt: log.sentAt!.toISOString(),
        category: this.resolveCategory(log.ruleId, categoryByRuleId, integration.defaultCategory),
        body: log.message.body ?? '',
        mediaUrl: sanitizeForwardMediaUrl(log.message.mediaUrl),
        ruleId: log.ruleId,
        ruleName: log.rule?.name ?? null,
        sourceChatTitle: findChatTitle(log.message.chatId),
        destinationChatTitle: findChatTitle(log.destinationChatId),
      }));
  }

  async listForwards(integration: IntegrationSlice, options: { cursor?: string | null; limit?: number }) {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    const cursor = decodeForwardsCursor(options.cursor);
    const ctx = await this.loadSinkContext(integration);

    if (!ctx) {
      return { items: [] as ForwardExportItem[], nextCursor: options.cursor ?? null, hasMore: false };
    }

    const { destinationJids, categoryByRuleId, primaryChat } = ctx;
    const byMessage = new Map<string, SendLogRow>();
    let dbCursor: ForwardsCursor | null = cursor;
    let rawScanned = 0;

    while (rawScanned < MAX_RAW_SCAN) {
      const batch = await this.fetchSendLogBatch(integration, destinationJids, dbCursor);
      if (!batch.length) {
        break;
      }
      rawScanned += batch.length;

      for (const log of batch) {
        if (!log.sentAt) {
          continue;
        }
        const existing = byMessage.get(log.messageId);
        if (!existing) {
          byMessage.set(log.messageId, log);
        } else {
          byMessage.set(log.messageId, this.preferLog(log, existing, primaryChat));
        }
      }

      const deduped = [...byMessage.values()]
        .filter((log) => this.compareCursor({ sentAt: log.sentAt!, messageId: log.messageId }, cursor) > 0)
        .sort((a, b) => this.compareRows({ sentAt: a.sentAt!, messageId: a.messageId }, { sentAt: b.sentAt!, messageId: b.messageId }));

      if (deduped.length > limit) {
        const page = deduped.slice(0, limit);
        const items = await this.mapLogsToItems(page, integration, categoryByRuleId);
        const last = page[page.length - 1];
        return {
          items,
          nextCursor: encodeForwardsCursor({
            sentAt: last.sentAt!.toISOString(),
            messageId: last.messageId,
          }),
          hasMore: true,
        };
      }

      const lastRaw = batch[batch.length - 1];
      if (!lastRaw.sentAt) {
        break;
      }
      dbCursor = {
        sentAt: lastRaw.sentAt.toISOString(),
        messageId: lastRaw.messageId,
      };

      if (batch.length < RAW_BATCH_SIZE) {
        break;
      }
    }

    const deduped = [...byMessage.values()]
      .filter((log) => this.compareCursor({ sentAt: log.sentAt!, messageId: log.messageId }, cursor) > 0)
      .sort((a, b) => this.compareRows({ sentAt: a.sentAt!, messageId: a.messageId }, { sentAt: b.sentAt!, messageId: b.messageId }));

    const page = deduped.slice(0, limit);
    const items = await this.mapLogsToItems(page, integration, categoryByRuleId);
    const last = page[page.length - 1];
    const nextCursor =
      last && last.sentAt
        ? encodeForwardsCursor({ sentAt: last.sentAt.toISOString(), messageId: last.messageId })
        : options.cursor ?? null;

    return { items, nextCursor, hasMore: false };
  }

  /** Recent sink forwards for admin preview (newest first). */
  async previewRecent(integration: IntegrationSlice, limit = 5) {
    const previewLimit = Math.min(Math.max(limit, 1), 20);
    const ctx = await this.loadSinkContext(integration);
    if (!ctx) {
      return { items: [] as ForwardExportItem[], count: 0 };
    }

    const { destinationJids, categoryByRuleId, primaryChat } = ctx;
    const byMessage = new Map<string, SendLogRow>();
    let rawScanned = 0;
    const maxScan = 800;

    while (rawScanned < maxScan) {
      const batch = await this.prisma.sendLog.findMany({
        where: {
          status: SendStatus.sent,
          sentAt: { not: null },
          destinationChatId: { in: destinationJids },
          message: { connectionId: integration.connectionId },
        },
        include: {
          message: { select: { chatId: true, body: true, mediaUrl: true } },
          rule: { select: { id: true, name: true } },
        },
        orderBy: [{ sentAt: 'desc' }, { messageId: 'desc' }],
        skip: rawScanned,
        take: RAW_BATCH_SIZE,
      });

      if (!batch.length) {
        break;
      }
      rawScanned += batch.length;

      for (const log of batch) {
        if (!log.sentAt) {
          continue;
        }
        const existing = byMessage.get(log.messageId);
        if (!existing) {
          byMessage.set(log.messageId, log);
        } else {
          byMessage.set(log.messageId, this.preferLog(log, existing, primaryChat));
        }
        if (byMessage.size >= previewLimit * 3) {
          break;
        }
      }

      if (byMessage.size >= previewLimit * 3 || batch.length < RAW_BATCH_SIZE) {
        break;
      }
    }

    const sorted = [...byMessage.values()]
      .filter((log) => log.sentAt)
      .sort((a, b) => this.compareRows({ sentAt: b.sentAt!, messageId: b.messageId }, { sentAt: a.sentAt!, messageId: a.messageId }))
      .slice(0, previewLimit);

    const items = await this.mapLogsToItems(sorted, integration, categoryByRuleId);
    return {
      count: items.length,
      items: items.map((row) => ({
        ...row,
        bodyPreview: row.body.length > 220 ? `${row.body.slice(0, 220)}…` : row.body,
      })),
    };
  }
}
