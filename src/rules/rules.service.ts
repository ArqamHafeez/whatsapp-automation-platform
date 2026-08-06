import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { Rule } from '@prisma/client';
import { AgentsService } from '../agents/agents.service';
import { DeliveryService } from '../delivery/delivery.service';
import { PipelineService } from '../pipeline/pipeline.service';
import { collectInboundJidCandidates, findAllChatsByInboundJid, findChatByInboundJid } from '../common/whatsapp/inbound-chat-jid';
import { normalizeWhatsAppJid } from '../common/whatsapp/jid-match';
import { isDeliverableWhatsAppJid } from '../common/whatsapp/jid-deliverable';
import { CreateRuleDto, UpdateRuleDto } from './rules.dto';
import { SimulateRuleDto } from './rules.simulate.dto';
import { assertPipelineAgentIdsValid, normalizePipelineAgentIds } from '../pipeline/pipeline-order';

@Injectable()
export class RulesService {
  private readonly logger = new Logger(RulesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agentsService: AgentsService,
    private readonly pipelineService: PipelineService,
    private readonly delivery: DeliveryService,
  ) {}

  private async getUserOrgId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.organizationId;
  }

  private async assertConnectionInOrg(orgId: string, connectionId: string): Promise<void> {
    const connection = await this.prisma.whatsAppConnection.findFirst({
      where: { id: connectionId, orgId },
    });
    if (!connection) {
      throw new BadRequestException('WhatsApp connection not found for this organization');
    }
  }

  private async validateChatIdsForRule(
    orgId: string,
    connectionId: string,
    sourceChatIds: string[],
    destinationChatIds: string[],
  ): Promise<void> {
    await this.assertConnectionInOrg(orgId, connectionId);

    const uniqueSources = [...new Set(sourceChatIds)];
    const uniqueDests = [...new Set(destinationChatIds)];

    if (uniqueSources.length !== sourceChatIds.length || uniqueDests.length !== destinationChatIds.length) {
      throw new BadRequestException('Duplicate chat IDs are not allowed in source or destination lists');
    }

    const overlap = uniqueSources.filter((id) => uniqueDests.includes(id));
    if (overlap.length > 0) {
      throw new BadRequestException('A chat cannot be both a source and a destination on the same rule');
    }

    const sourceRows = await this.prisma.chat.findMany({
      where: {
        id: { in: uniqueSources },
        connectionId,
        connection: { orgId },
      },
      select: { id: true },
    });
    if (sourceRows.length !== uniqueSources.length) {
      throw new BadRequestException(
        'Every source must be a synced chat on the selected WhatsApp connection. Sync chats on Chats & Groups first.',
      );
    }

    const destRows = await this.prisma.chat.findMany({
      where: {
        id: { in: uniqueDests },
        connectionId,
        connection: { orgId },
      },
      select: { id: true },
    });
    if (destRows.length !== uniqueDests.length) {
      throw new BadRequestException(
        'Every destination must be a synced chat on the selected WhatsApp connection. Sync chats on Chats & Groups first.',
      );
    }
  }

  private async normalizeAndValidatePipeline(orgId: string, agentIds: string[]): Promise<string[]> {
    if (!agentIds.length) {
      return [];
    }
    await this.agentsService.assertAgentsInOrg(orgId, agentIds);
    const agents = await this.prisma.agent.findMany({
      where: { orgId, id: { in: agentIds } },
      select: { id: true, type: true, isActive: true },
    });
    try {
      assertPipelineAgentIdsValid(agentIds, agents);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    return normalizePipelineAgentIds(agentIds, agents);
  }

  async listRules(userId: string) {
    const orgId = await this.getUserOrgId(userId);
    return this.prisma.rule.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRule(userId: string, data: CreateRuleDto) {
    const orgId = await this.getUserOrgId(userId);

    await this.validateChatIdsForRule(
      orgId,
      data.connectionId,
      data.sourceChatIds,
      data.destinationChatIds,
    );

    const pipelineAgentIds = await this.normalizeAndValidatePipeline(orgId, data.pipelineAgentIds ?? []);

    return this.prisma.rule.create({
      data: {
        orgId,
        connectionId: data.connectionId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        isActive: data.isActive ?? true,
        reviewMode: data.reviewMode || 'on_escalation',
        reviewTimeoutMinutes: data.reviewTimeoutMinutes ?? 1440,
        sourceChatIds: data.sourceChatIds,
        destinationChatIds: data.destinationChatIds,
        pipelineAgentIds,
        pipelineFailOpen: true,
      },
    });
  }

  async getRule(userId: string, id: string) {
    const orgId = await this.getUserOrgId(userId);
    const rule = await this.prisma.rule.findFirst({ where: { id, orgId } });
    if (!rule) {
      throw new NotFoundException('Rule not found');
    }
    return rule;
  }

  async updateRule(userId: string, id: string, data: UpdateRuleDto) {
    const orgId = await this.getUserOrgId(userId);
    const existing = await this.prisma.rule.findFirst({ where: { id, orgId } });
    if (!existing) {
      throw new NotFoundException('Rule not found');
    }

    const nextConnectionId = data.connectionId ?? existing.connectionId;
    const nextSources = data.sourceChatIds ?? existing.sourceChatIds;
    const nextDests = data.destinationChatIds ?? existing.destinationChatIds;
    const nextPipelineAgentIds = data.pipelineAgentIds ?? existing.pipelineAgentIds;

    if (
      data.connectionId !== undefined ||
      data.sourceChatIds !== undefined ||
      data.destinationChatIds !== undefined
    ) {
      await this.validateChatIdsForRule(orgId, nextConnectionId, nextSources, nextDests);
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.connectionId !== undefined) updateData.connectionId = data.connectionId;
    if (data.sourceChatIds !== undefined) updateData.sourceChatIds = data.sourceChatIds;
    if (data.destinationChatIds !== undefined) updateData.destinationChatIds = data.destinationChatIds;
    if (data.reviewMode !== undefined) updateData.reviewMode = data.reviewMode;
    if (data.reviewTimeoutMinutes !== undefined) updateData.reviewTimeoutMinutes = data.reviewTimeoutMinutes;
    if (data.pipelineAgentIds !== undefined) {
      updateData.pipelineAgentIds = await this.normalizeAndValidatePipeline(orgId, nextPipelineAgentIds);
    }

    return this.prisma.rule.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteRule(userId: string, id: string) {
    const orgId = await this.getUserOrgId(userId);
    const existing = await this.prisma.rule.findFirst({ where: { id, orgId } });
    if (!existing) {
      throw new NotFoundException('Rule not found');
    }
    await this.prisma.rule.delete({ where: { id } });
    return { deleted: true, id };
  }

  /** Resolve any synced chat row matching WAHA's inbound JID candidates. */
  async findChatForInboundPayload(
    msgData: Record<string, unknown>,
    orgId: string,
    connectionId: string,
  ) {
    const chats = await this.prisma.chat.findMany({
      where: {
        connectionId,
        connection: { orgId },
      },
      select: { id: true, externalChatId: true, metadata: true },
    });

    const candidates = collectInboundJidCandidates(msgData);
    const tried = new Set<string>();

    for (const jid of candidates) {
      const key = normalizeWhatsAppJid(jid);
      if (tried.has(key)) {
        continue;
      }
      tried.add(key);

      const chat = findChatByInboundJid(chats, jid);
      if (chat) {
        return chat;
      }
    }

    return null;
  }

  /**
   * Match inbound webhook payload to active rules, trying every JID candidate WAHA sent.
   */
  async findMatchingRulesForInbound(
    msgData: Record<string, unknown>,
    orgId: string,
    connectionId: string,
  ): Promise<{ rules: Rule[]; chat: { id: string; externalChatId: string; metadata: unknown } | null }> {
    const chats = await this.prisma.chat.findMany({
      where: {
        connectionId,
        connection: { orgId },
      },
      select: { id: true, externalChatId: true, metadata: true },
    });

    const candidates = collectInboundJidCandidates(msgData);
    const tried = new Set<string>();

    for (const jid of candidates) {
      const key = normalizeWhatsAppJid(jid);
      if (tried.has(key)) {
        continue;
      }
      tried.add(key);

      const matchingChats = findAllChatsByInboundJid(chats, jid);
      if (!matchingChats.length) {
        continue;
      }

      const matchingChatIds = matchingChats.map((c) => c.id);
      const rules = await this.prisma.rule.findMany({
        where: {
          orgId,
          connectionId,
          isActive: true,
          sourceChatIds: {
            hasSome: matchingChatIds,
          },
        },
      });

      if (rules.length) {
        const matchedChat =
          matchingChats.find((c) => rules.some((r) => r.sourceChatIds.includes(c.id))) ?? matchingChats[0];
        return { rules, chat: matchedChat };
      }
    }

    return { rules: [] as Rule[], chat: null };
  }

  /** Resolve a webhook JID to a synced Chat row (handles @lid ↔ @c.us aliases). */
  async findChatForInboundJid(externalChatJid: string, orgId: string, connectionId: string) {
    const chats = await this.prisma.chat.findMany({
      where: {
        connectionId,
        connection: { orgId },
      },
      select: { id: true, externalChatId: true, metadata: true },
    });

    return findChatByInboundJid(chats, externalChatJid);
  }

  /**
   * Internal use only — called from WebhookController's incoming-message handling.
   * Only rules bound to the same WhatsApp connection as the inbound message are considered.
   */
  async findMatchingRules(externalChatJid: string, orgId: string, connectionId: string) {
    const chats = await this.prisma.chat.findMany({
      where: {
        connectionId,
        connection: { orgId },
      },
      select: { id: true, externalChatId: true, metadata: true },
    });

    const matchingChats = findAllChatsByInboundJid(chats, externalChatJid);
    if (!matchingChats.length) {
      return [];
    }

    return this.prisma.rule.findMany({
      where: {
        orgId,
        connectionId,
        isActive: true,
        sourceChatIds: {
          hasSome: matchingChats.map((c) => c.id),
        },
      },
    });
  }

  /** Resolves internal Chat.id values to Evolution remote JIDs on one connection. */
  async resolveDestinationJids(
    destinationChatIds: string[],
    orgId: string,
    connectionId: string,
  ): Promise<string[]> {
    if (!destinationChatIds.length) {
      return [];
    }

    const chats = await this.prisma.chat.findMany({
      where: {
        id: { in: destinationChatIds },
        connectionId,
        connection: { orgId },
      },
      select: { externalChatId: true },
    });

    return chats
      .map((c) => c.externalChatId)
      .filter((jid) => isDeliverableWhatsAppJid(jid));
  }

  async simulateRule(userId: string, ruleId: string, data: SimulateRuleDto) {
    const orgId = await this.getUserOrgId(userId);
    const rule = await this.prisma.rule.findFirst({
      where: { id: ruleId, orgId },
    });
    if (!rule) {
      throw new NotFoundException('Rule not found');
    }
    if (!rule.isActive) {
      throw new BadRequestException('Rule is paused — activate it before simulating');
    }
    if (!rule.sourceChatIds.length) {
      throw new BadRequestException('Rule has no source chats configured');
    }

    const sourceChat = await this.prisma.chat.findFirst({
      where: {
        id: { in: rule.sourceChatIds },
        connectionId: rule.connectionId,
        connection: { orgId },
      },
    });
    if (!sourceChat) {
      throw new BadRequestException('Source chat not found for this rule');
    }

    const waMessageId = `ui-sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const message = await this.prisma.message.create({
      data: {
        waMessageId,
        connectionId: rule.connectionId,
        chatId: sourceChat.externalChatId,
        sender: data.sender?.trim() || 'UI Simulator',
        body: data.body.trim(),
        type: 'text',
        mediaUrl: null,
        metadata: { simulated: true, ruleId: rule.id },
      },
    });

    const pipelineResult = await this.pipelineService.runForRule({
      messageId: message.id,
      ruleId: rule.id,
      orgId,
      connectionId: rule.connectionId,
    });

    let deliveriesQueued = 0;
    if (pipelineResult.action === 'forward') {
      const destinationJids = await this.resolveDestinationJids(
        pipelineResult.destinationChatIds,
        orgId,
        rule.connectionId,
      );
      for (const destChatJid of destinationJids) {
        await this.delivery.enqueueDelivery({
          messageId: message.id,
          destinationChatId: destChatJid,
          ruleId: rule.id,
          connectionId: rule.connectionId,
          body: pipelineResult.body,
          type: pipelineResult.type,
          mediaUrl: pipelineResult.mediaUrl,
          pipelineMode: pipelineResult.pipelineMode,
        });
        deliveriesQueued += 1;
      }
    }

    this.logger.log(
      `UI simulate rule=${rule.id} message=${message.id} action=${pipelineResult.action} deliveries=${deliveriesQueued}`,
    );

    return {
      messageId: message.id,
      pipelineAction: pipelineResult.action,
      pipelineMode: pipelineResult.pipelineMode,
      decisionId: pipelineResult.decisionId,
      reason: pipelineResult.action === 'skip' || pipelineResult.action === 'review' ? pipelineResult.reason : undefined,
      reviewItemId: pipelineResult.action === 'review' ? pipelineResult.reviewItemId : undefined,
      deliveriesQueued,
      destinationCount:
        pipelineResult.action === 'forward' ? pipelineResult.destinationChatIds.length : 0,
    };
  }
}
