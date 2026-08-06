import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RulesService } from '../rules/rules.service';
import { DeliveryService } from '../delivery/delivery.service';
import { PipelineService } from '../pipeline/pipeline.service';
import {
  fetchWahaMediaDataUrl,
  mediaNeedsWahaFetch,
  parseWahaIncomingMessage,
} from '../common/waha/waha-message';
import { resolveInboundChatJid } from '../common/whatsapp/inbound-chat-jid';

export type InboundProcessResult =
  | { action: 'duplicate_ignored'; messageId: string }
  | { action: 'ignored'; reason: string }
  | {
      action: 'processed';
      messageId: string;
      messageType: string;
      hasMedia: boolean;
      rulesMatched: number;
      pipelineRuns: number;
      reviewsQueued: number;
      destinations: number;
    };

@Injectable()
export class InboundMessageService {
  private readonly logger = new Logger(InboundMessageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rulesService: RulesService,
    private readonly pipelineService: PipelineService,
    private readonly delivery: DeliveryService,
  ) {}

  async processWahaPayload(
    payload: Record<string, unknown>,
    options?: { skipFromMe?: boolean },
  ): Promise<InboundProcessResult> {
    const sessionName = String(payload?.session ?? 'unknown');
    const msgData = (payload?.payload ?? payload?.data ?? payload) as Record<string, unknown>;

    if (options?.skipFromMe !== false && msgData.fromMe) {
      return { action: 'ignored', reason: 'from_me' };
    }

    const instance = await this.prisma.whatsAppConnection.findFirst({
      where: {
        OR: [{ externalId: sessionName }, { name: sessionName }],
      },
    });
    if (!instance) {
      return { action: 'ignored', reason: 'session_not_found' };
    }

    const waMessageId = typeof msgData.id === 'string' ? msgData.id : undefined;
    const rawChatId = resolveInboundChatJid(msgData);
    if (!waMessageId || !rawChatId) {
      return { action: 'ignored', reason: 'missing_message_id_or_chat' };
    }

    const existing = await this.prisma.message.findUnique({
      where: { waMessageId_connectionId: { waMessageId, connectionId: instance.id } },
    });
    if (existing) {
      return { action: 'duplicate_ignored', messageId: existing.id };
    }

    const syncedChat = await this.rulesService.findChatForInboundPayload(
      msgData,
      instance.orgId,
      instance.id,
    );
    const chatId = syncedChat?.externalChatId ?? rawChatId;
    const { rules: matchedRules } = await this.rulesService.findMatchingRulesForInbound(
      msgData,
      instance.orgId,
      instance.id,
    );

    const author = typeof msgData.author === 'string' ? msgData.author : null;
    const participant = typeof msgData.participant === 'string' ? msgData.participant : null;
    const pushName =
      (typeof msgData.pushName === 'string' && msgData.pushName) ||
      (typeof msgData.notifyName === 'string' && msgData.notifyName) ||
      author ||
      participant ||
      chatId ||
      'unknown';

    let parsed = parseWahaIncomingMessage(msgData);
    if (mediaNeedsWahaFetch(parsed)) {
      const media = msgData.media as Record<string, unknown> | undefined;
      const mediaUrl =
        (typeof msgData.mediaUrl === 'string' && msgData.mediaUrl) ||
        (typeof media?.url === 'string' && media.url) ||
        null;
      if (mediaUrl) {
        const dataUrl = await fetchWahaMediaDataUrl(mediaUrl, parsed.mimeType);
        if (dataUrl) {
          parsed = { ...parsed, mediaUrl: dataUrl };
        }
      }
    }

    const prismaType = parsed.type === 'unknown' ? 'text' : parsed.type;

    let message;
    try {
      message = await this.prisma.message.create({
        data: {
          waMessageId,
          connectionId: instance.id,
          chatId,
          sender: pushName,
          body: parsed.body,
          type: prismaType,
          mediaUrl: parsed.mediaUrl,
          metadata: payload as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const duplicate = await this.prisma.message.findUnique({
          where: { waMessageId_connectionId: { waMessageId, connectionId: instance.id } },
        });
        if (duplicate) {
          return { action: 'duplicate_ignored', messageId: duplicate.id };
        }
      }
      throw err;
    }

    let pipelineRuns = 0;
    let deliveriesQueued = 0;
    let reviewsQueued = 0;

    for (const rule of matchedRules) {
      const pipelineResult = await this.pipelineService.runForRule({
        messageId: message.id,
        ruleId: rule.id,
        orgId: instance.orgId,
        connectionId: instance.id,
      });
      pipelineRuns += 1;

      if (pipelineResult.action === 'review') {
        reviewsQueued += 1;
        continue;
      }
      if (pipelineResult.action !== 'forward') {
        continue;
      }

      const destinationJids = await this.rulesService.resolveDestinationJids(
        pipelineResult.destinationChatIds,
        instance.orgId,
        instance.id,
      );
      for (const destChatJid of destinationJids) {
        await this.delivery.enqueueDelivery({
          messageId: message.id,
          destinationChatId: destChatJid,
          ruleId: rule.id,
          connectionId: instance.id,
          body: pipelineResult.body,
          type: pipelineResult.type,
          mediaUrl: pipelineResult.mediaUrl,
          pipelineMode: pipelineResult.pipelineMode,
        });
        deliveriesQueued += 1;
      }
    }

    return {
      action: 'processed',
      messageId: message.id,
      messageType: message.type,
      hasMedia: Boolean(message.mediaUrl),
      rulesMatched: matchedRules.length,
      pipelineRuns,
      reviewsQueued,
      destinations: deliveriesQueued,
    };
  }
}
