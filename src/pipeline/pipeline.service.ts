<<<<<<< HEAD
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Agent, Message, Prisma, Rule } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiService } from '../common/ai/ai.service';
import { ImageEditService } from '../common/image/image-edit.service';
import { getAiConfig } from '../common/ai/ai.config';
import { AgentRunContext } from '../common/ai/ai.types';
import { findChatByInboundJid } from '../common/whatsapp/inbound-chat-jid';
import {
  PipelineRunInput,
  PipelineRunResult,
  PipelineStepLog,
  PipelineMode,
} from './pipeline.types';

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly imageEditService: ImageEditService,
  ) {}

  async runForRule(input: PipelineRunInput): Promise<PipelineRunResult> {
    const message = await this.prisma.message.findUnique({ where: { id: input.messageId } });
    if (!message) {
      throw new NotFoundException('Message not found for pipeline run');
    }

    const rule = await this.prisma.rule.findFirst({
      where: { id: input.ruleId, orgId: input.orgId, connectionId: input.connectionId },
    });
    if (!rule) {
      throw new NotFoundException('Rule not found for pipeline run');
    }

    if (!rule.pipelineAgentIds.length) {
      return this.finalizeForward(message, rule, input, {
        pipelineMode: 'passthrough',
        stepLogs: [{ agentId: '-', agentName: '-', agentType: '-', status: 'skipped_type', note: 'No pipeline agents' }],
        decisionType: 'forward',
        needsReview: false,
      });
    }

    const agents = await this.loadAgentsInOrder(input.orgId, rule.pipelineAgentIds);
    if (agents.length !== rule.pipelineAgentIds.length) {
      this.logger.warn(`Rule ${rule.id} has missing/inactive pipeline agents`);
      return this.finalizeForward(message, rule, input, {
        pipelineMode: 'fail_open',
        stepLogs: [
          {
            agentId: '-',
            agentName: '-',
            agentType: '-',
            status: 'error',
            error: 'One or more pipeline agents are missing or inactive',
          },
        ],
        decisionType: 'forward',
        errorDetails: 'Missing/inactive pipeline agents',
        needsReview: false,
      });
    }

    let context = await this.buildAgentContext(message, rule, input, rule.destinationChatIds);
    const stepLogs: PipelineStepLog[] = [];
    let body = message.body;
    let destinationChatIds = [...rule.destinationChatIds];
    let mediaUrl = message.mediaUrl;
    let originalMediaUrl: string | null = message.mediaUrl;
    const type = message.type;
    let needsReview = false;
    let watermarkDetected = false;

    for (const agent of agents) {
      const agentContext: AgentRunContext = {
        ...context,
        message: { ...context.message, body, mediaUrl },
        destinationChats: this.buildDestinationChats(context, destinationChatIds),
      };

      if (agent.type === 'relevance') {
        const stop = await this.runRelevanceStep({
          agent,
          agentContext,
          rule,
          message,
          input,
          stepLogs,
          body,
          type,
          mediaUrl,
          destinationChatIds,
          onNeedsReview: () => {
            needsReview = true;
          },
          onWatermarkDetected: () => {
            watermarkDetected = true;
          },
        });
        if (stop) {
          return stop;
        }
        continue;
      }

      if (agent.type === 'image_edit') {
        const stop = await this.runImageEditStep({
          agent,
          agentContext,
          rule,
          message,
          input,
          stepLogs,
          body,
          type,
          mediaUrl,
          destinationChatIds,
          watermarkDetected,
          onMediaUpdated: (nextMediaUrl, nextOriginal) => {
            mediaUrl = nextMediaUrl;
            if (nextOriginal) {
              originalMediaUrl = nextOriginal;
            }
          },
          onNeedsReview: () => {
            needsReview = true;
          },
          onReviewCleared: () => {
            needsReview = false;
          },
        });
        if (stop) {
          return stop;
        }
        continue;
      }

      if (agent.type === 'clean') {
        const stop = await this.runCleanStep({
          agent,
          agentContext,
          rule,
          message,
          input,
          stepLogs,
          body,
          type,
          mediaUrl,
          destinationChatIds,
          onBodyUpdated: (nextBody) => {
            body = nextBody;
          },
        });
        if (stop) {
          return stop;
        }
        continue;
      }

      if (agent.type === 'route') {
        const stop = await this.runRouteStep({
          agent,
          agentContext,
          rule,
          message,
          input,
          stepLogs,
          body,
          type,
          mediaUrl,
          destinationChatIds,
          onDestinationsUpdated: (nextIds) => {
            destinationChatIds = nextIds;
          },
          onNeedsReview: () => {
            needsReview = true;
          },
        });
        if (stop) {
          return stop;
        }
        continue;
      }

      stepLogs.push({
        agentId: agent.id,
        agentName: agent.name,
        agentType: agent.type,
        status: 'skipped_type',
        note: `${agent.type} agent execution lands in a later sprint`,
      });
    }

    return this.finalizeForward(message, rule, input, {
      pipelineMode: 'executed',
      stepLogs,
      decisionType: 'forward',
      body,
      type,
      mediaUrl,
      originalMediaUrl,
      destinationChatIds,
      needsReview,
    });
  }

  async getDecisionsForMessage(userId: string, messageId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const message = await this.prisma.message.findFirst({
      where: { id: messageId },
      select: { id: true, connectionId: true },
    });
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const connection = await this.prisma.whatsAppConnection.findFirst({
      where: { id: message.connectionId, orgId: user.organizationId },
      select: { id: true },
    });
    if (!connection) {
      throw new NotFoundException('Message not found');
    }

    return this.prisma.pipelineDecision.findMany({
      where: { messageId },
      orderBy: { createdAt: 'desc' },
      include: {
        rule: { select: { id: true, name: true } },
      },
    });
  }

  private async runRelevanceStep(opts: {
    agent: Agent;
    agentContext: AgentRunContext;
    rule: Rule;
    message: Message;
    input: PipelineRunInput;
    stepLogs: PipelineStepLog[];
    body: string | null;
    type: string;
    mediaUrl: string | null;
    destinationChatIds: string[];
    onNeedsReview: () => void;
    onWatermarkDetected?: () => void;
  }): Promise<PipelineRunResult | null> {
    try {
      const result = await this.aiService.runRelevanceAgent(opts.agent, opts.agentContext);
      opts.stepLogs.push({
        agentId: opts.agent.id,
        agentName: opts.agent.name,
        agentType: opts.agent.type,
        status: 'completed',
        output: result,
      });

      if (!result.relevant) {
        return this.createSkipResult(opts.message, opts.rule, {
          pipelineMode: 'executed',
          reason: result.reason,
          stepLogs: opts.stepLogs,
        });
      }

      if (result.detectedWatermark) {
        opts.onWatermarkDetected?.();
      }

      if (result.needsReview) {
        opts.onNeedsReview();
        opts.stepLogs[opts.stepLogs.length - 1].note = result.detectedWatermark
          ? 'watermark detected — review or image edit may follow'
          : 'needsReview flagged for human review';
      }
      return null;
    } catch (err) {
      return this.handleAgentError(opts, err as Error, 'Relevance');
    }
  }

  private async runImageEditStep(opts: {
    agent: Agent;
    agentContext: AgentRunContext;
    rule: Rule;
    message: Message;
    input: PipelineRunInput;
    stepLogs: PipelineStepLog[];
    body: string | null;
    type: string;
    mediaUrl: string | null;
    destinationChatIds: string[];
    watermarkDetected: boolean;
    onMediaUpdated: (mediaUrl: string | null, originalMediaUrl: string | null) => void;
    onNeedsReview: () => void;
    onReviewCleared: () => void;
  }): Promise<PipelineRunResult | null> {
    try {
      const result = await this.imageEditService.runImageEditAgent(opts.agent, opts.agentContext, {
        watermarkHint: opts.watermarkDetected,
      });

      opts.stepLogs.push({
        agentId: opts.agent.id,
        agentName: opts.agent.name,
        agentType: opts.agent.type,
        status: result.edited ? 'completed' : 'skipped_type',
        output: result,
        note: result.reason,
      });

      if (result.edited && result.mediaUrl) {
        opts.onMediaUpdated(result.mediaUrl, result.originalMediaUrl);
        await this.prisma.message.update({
          where: { id: opts.message.id },
          data: { mediaUrl: result.mediaUrl },
        });
        if (!result.needsReview) {
          opts.onReviewCleared();
        }
      } else if (result.needsReview) {
        opts.onNeedsReview();
      }

      return null;
    } catch (err) {
      opts.onNeedsReview();
      return this.handleAgentError(opts, err as Error, 'Image edit');
    }
  }

  private async runCleanStep(opts: {
    agent: Agent;
    agentContext: AgentRunContext;
    rule: Rule;
    message: Message;
    input: PipelineRunInput;
    stepLogs: PipelineStepLog[];
    body: string | null;
    type: string;
    mediaUrl: string | null;
    destinationChatIds: string[];
    onBodyUpdated: (body: string | null) => void;
  }): Promise<PipelineRunResult | null> {
    const textToClean = opts.body?.trim() || '';
    if (!textToClean) {
      opts.stepLogs.push({
        agentId: opts.agent.id,
        agentName: opts.agent.name,
        agentType: opts.agent.type,
        status: 'skipped_type',
        note: 'No text or caption to clean',
      });
      return null;
    }

    try {
      const result = await this.aiService.runCleanAgent(opts.agent, opts.agentContext);
      opts.stepLogs.push({
        agentId: opts.agent.id,
        agentName: opts.agent.name,
        agentType: opts.agent.type,
        status: 'completed',
        output: result,
      });

      opts.onBodyUpdated(result.cleanedText);
      this.logger.log(
        `Clean agent ${opts.agent.id} updated body for message ${opts.message.id} (${result.changes.length} change(s))`,
      );
      return null;
    } catch (err) {
      return this.handleAgentError(opts, err as Error, 'Clean');
    }
  }

  private async runRouteStep(opts: {
    agent: Agent;
    agentContext: AgentRunContext;
    rule: Rule;
    message: Message;
    input: PipelineRunInput;
    stepLogs: PipelineStepLog[];
    body: string | null;
    type: string;
    mediaUrl: string | null;
    destinationChatIds: string[];
    onDestinationsUpdated: (ids: string[]) => void;
    onNeedsReview: () => void;
  }): Promise<PipelineRunResult | null> {
    if (opts.destinationChatIds.length <= 1) {
      opts.stepLogs.push({
        agentId: opts.agent.id,
        agentName: opts.agent.name,
        agentType: opts.agent.type,
        status: 'skipped_type',
        note: 'Route agent skipped — only one destination configured',
      });
      return null;
    }

    try {
      const result = await this.aiService.runRouteAgent(
        opts.agent,
        opts.agentContext,
        opts.destinationChatIds,
      );
      opts.stepLogs.push({
        agentId: opts.agent.id,
        agentName: opts.agent.name,
        agentType: opts.agent.type,
        status: 'completed',
        output: result,
      });

      if (!result.destinationChatIds.length) {
        this.logger.warn(
          `Route agent ${opts.agent.id} selected no valid destinations for message ${opts.message.id} (check route agent returns chatId UUIDs, not group titles)`,
        );
        return this.createSkipResult(opts.message, opts.rule, {
          pipelineMode: 'executed',
          reason: result.reason || 'Route agent selected no destinations',
          stepLogs: opts.stepLogs,
        });
      }

      const { relevanceEscalationConfidence } = getAiConfig();
      if (result.confidence < relevanceEscalationConfidence) {
        opts.onNeedsReview();
        opts.stepLogs[opts.stepLogs.length - 1].note =
          'Route agent low confidence — flagged for human review on escalation';
      }

      const previousCount = opts.destinationChatIds.length;
      opts.onDestinationsUpdated(result.destinationChatIds);
      this.logger.log(
        `Route agent ${opts.agent.id} selected ${result.destinationChatIds.length}/${previousCount} destination(s) for message ${opts.message.id}`,
      );
      return null;
    } catch (err) {
      return this.handleAgentError(opts, err as Error, 'Route', opts.rule.destinationChatIds);
    }
  }

  private async handleAgentError(
    opts: {
      agent: Agent;
      rule: Rule;
      message: Message;
      input: PipelineRunInput;
      stepLogs: PipelineStepLog[];
      body: string | null;
      type: string;
      mediaUrl: string | null;
      destinationChatIds: string[];
    },
    err: Error,
    label: string,
    failOpenDestinationChatIds?: string[],
  ): Promise<PipelineRunResult | null> {
    const errorMessage = err.message;
    opts.stepLogs.push({
      agentId: opts.agent.id,
      agentName: opts.agent.name,
      agentType: opts.agent.type,
      status: 'error',
      error: errorMessage,
    });

    this.logger.warn(`${label} agent error — global fail-open forward for rule ${opts.rule.id}`);
    return this.finalizeForward(opts.message, opts.rule, opts.input, {
      pipelineMode: 'fail_open',
      stepLogs: opts.stepLogs,
      decisionType: 'forward',
      errorDetails: errorMessage,
      body: opts.body,
      type: opts.type,
      mediaUrl: opts.mediaUrl,
      destinationChatIds: failOpenDestinationChatIds ?? opts.destinationChatIds,
      needsReview: false,
    });
  }

  private async loadAgentsInOrder(orgId: string, agentIds: string[]): Promise<Agent[]> {
    const rows = await this.prisma.agent.findMany({
      where: { orgId, id: { in: agentIds }, isActive: true },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return agentIds.map((id) => byId.get(id)).filter((row): row is Agent => Boolean(row));
  }

  private async buildAgentContext(
    message: Message,
    rule: Rule,
    input: PipelineRunInput,
    destinationChatIds: string[],
  ): Promise<AgentRunContext & { _destinationChatRows?: Array<{ id: string; title: string | null; description: string | null; externalChatId: string; type: string }> }> {
    const chats = await this.prisma.chat.findMany({
      where: { connectionId: input.connectionId, connection: { orgId: input.orgId } },
      select: { id: true, externalChatId: true, title: true, description: true, type: true, metadata: true },
    });
    const sourceChat = findChatByInboundJid(chats, message.chatId);
    const destinationChats = this.buildDestinationChatsFromRows(chats, destinationChatIds);

    return {
      message: {
        body: message.body,
        type: message.type,
        sender: message.sender,
        chatId: message.chatId,
        mediaUrl: message.mediaUrl,
      },
      rule: {
        name: rule.name,
        description: rule.description,
      },
      sourceChat: sourceChat
        ? {
            title: sourceChat.title,
            description: sourceChat.description,
            externalChatId: sourceChat.externalChatId,
            type: String(sourceChat.type),
          }
        : undefined,
      destinationChats,
      _destinationChatRows: destinationChats,
    };
  }

  private buildDestinationChats(
    context: AgentRunContext & { _destinationChatRows?: Array<{ id: string; title: string | null; description: string | null; externalChatId: string; type: string }> },
    destinationChatIds: string[],
  ) {
    const rows = context._destinationChatRows ?? context.destinationChats ?? [];
    const byId = new Map(rows.map((row) => [row.id, row]));
    return destinationChatIds
      .map((id) => byId.get(id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  }

  private buildDestinationChatsFromRows(
    chats: Array<{ id: string; externalChatId: string; title: string | null; description: string | null; type: string }>,
    destinationChatIds: string[],
  ) {
    const byId = new Map(chats.map((chat) => [chat.id, chat]));
    return destinationChatIds
      .map((id) => byId.get(id))
      .filter((chat): chat is NonNullable<typeof chat> => Boolean(chat))
      .map((chat) => ({
        id: chat.id,
        title: chat.title,
        description: chat.description,
        externalChatId: chat.externalChatId,
        type: String(chat.type),
      }));
  }

  private shouldHoldForReview(rule: Rule, _pipelineMode: PipelineMode, needsReview: boolean): boolean {
    const mode = rule.reviewMode || 'on_escalation';
    if (mode === 'off') {
      return false;
    }
    if (mode === 'always') {
      return true;
    }
    return needsReview;
  }

  private buildReviewReason(rule: Rule, _pipelineMode: PipelineMode, needsReview: boolean): string {
    if (rule.reviewMode === 'always') {
      return 'Review required (review mode: always)';
    }
    if (needsReview) {
      return 'Agent flagged message for human review';
    }
    return 'Review required';
  }

  private async finalizeForward(
    message: Message,
    rule: Rule,
    input: PipelineRunInput,
    opts: {
      pipelineMode: PipelineMode;
      stepLogs: PipelineStepLog[];
      decisionType?: string;
      errorDetails?: string;
      body?: string | null;
      type?: string;
      mediaUrl?: string | null;
      originalMediaUrl?: string | null;
      destinationChatIds?: string[];
      needsReview?: boolean;
      reviewReasonOverride?: string;
    },
  ): Promise<PipelineRunResult> {
    const destinations = opts.destinationChatIds ?? rule.destinationChatIds;
    const body = opts.body ?? message.body;
    const type = opts.type ?? message.type;
    const mediaUrl = opts.mediaUrl ?? message.mediaUrl;
    const needsReview = opts.needsReview ?? false;

    if (this.shouldHoldForReview(rule, opts.pipelineMode, needsReview)) {
      return this.createReviewResult(message, rule, input, {
        pipelineMode: opts.pipelineMode,
        stepLogs: opts.stepLogs,
        body,
        type,
        mediaUrl,
        originalMediaUrl: opts.originalMediaUrl ?? message.mediaUrl,
        destinationChatIds: destinations,
        needsReview,
        reviewReasonOverride: opts.reviewReasonOverride,
      });
    }

    return this.createForwardResult(message, rule, {
      pipelineMode: opts.pipelineMode,
      stepLogs: opts.stepLogs,
      decisionType: opts.decisionType ?? 'forward',
      errorDetails: opts.errorDetails,
      body,
      type,
      mediaUrl,
      destinationChatIds: destinations,
    });
  }

  private async createReviewResult(
    message: Message,
    rule: Rule,
    input: PipelineRunInput,
    opts: {
      pipelineMode: PipelineMode;
      stepLogs: PipelineStepLog[];
      body: string | null;
      type: string;
      mediaUrl: string | null;
      originalMediaUrl?: string | null;
      destinationChatIds: string[];
      needsReview: boolean;
      reviewReasonOverride?: string;
    },
  ): Promise<PipelineRunResult> {
    const reviewReason =
      opts.reviewReasonOverride?.trim() ||
      this.buildReviewReason(rule, opts.pipelineMode, opts.needsReview);
    const expiresAt = new Date(Date.now() + rule.reviewTimeoutMinutes * 60_000);

    const decision = await this.prisma.pipelineDecision.create({
      data: {
        messageId: message.id,
        ruleId: rule.id,
        decisionType: 'review',
        destinations: opts.destinationChatIds,
        body: opts.body,
        mediaUrl: opts.mediaUrl,
        status: 'completed',
        pipelineMode: opts.pipelineMode,
        reviewReason,
        stepLogs: opts.stepLogs as unknown as Prisma.InputJsonValue,
      },
    });

    const payload = {
      connectionId: input.connectionId,
      body: opts.body,
      type: opts.type,
      mediaUrl: opts.mediaUrl,
      originalMediaUrl: opts.originalMediaUrl ?? null,
      destinationChatIds: opts.destinationChatIds,
      pipelineMode: opts.pipelineMode,
      reviewReason,
      pipelineDecisionId: decision.id,
    };

    const reviewItem = await this.prisma.reviewItem.create({
      data: {
        messageId: message.id,
        ruleId: rule.id,
        status: 'pending',
        expiresAt,
        originalPayload: JSON.stringify(payload),
      },
    });

    this.logger.log(
      `Pipeline review queued rule=${rule.id} message=${message.id} reviewItem=${reviewItem.id}`,
    );

    return {
      action: 'review',
      reason: reviewReason,
      pipelineMode: opts.pipelineMode,
      decisionId: decision.id,
      reviewItemId: reviewItem.id,
      destinationChatIds: opts.destinationChatIds,
      body: opts.body,
      type: opts.type,
      mediaUrl: opts.mediaUrl,
    };
  }

  private async createForwardResult(
    message: Message,
    rule: Rule,
    opts: {
      pipelineMode: PipelineMode;
      stepLogs: PipelineStepLog[];
      decisionType: string;
      errorDetails?: string;
      body?: string | null;
      type?: string;
      mediaUrl?: string | null;
      destinationChatIds?: string[];
    },
  ): Promise<PipelineRunResult> {
    const destinations = opts.destinationChatIds ?? rule.destinationChatIds;
    const decision = await this.prisma.pipelineDecision.create({
      data: {
        messageId: message.id,
        ruleId: rule.id,
        decisionType: opts.decisionType,
        destinations,
        body: opts.body ?? message.body,
        mediaUrl: opts.mediaUrl ?? message.mediaUrl,
        status: 'completed',
        pipelineMode: opts.pipelineMode,
        stepLogs: opts.stepLogs as unknown as Prisma.InputJsonValue,
        errorDetails: opts.errorDetails ?? null,
      },
    });

    return {
      action: 'forward',
      destinationChatIds: destinations,
      body: opts.body ?? message.body,
      type: opts.type ?? message.type,
      mediaUrl: opts.mediaUrl ?? message.mediaUrl,
      pipelineMode: opts.pipelineMode,
      decisionId: decision.id,
    };
  }

  private async createSkipResult(
    message: Message,
    rule: Rule,
    opts: {
      pipelineMode: PipelineMode;
      reason: string;
      stepLogs: PipelineStepLog[];
    },
  ): Promise<PipelineRunResult> {
    const decision = await this.prisma.pipelineDecision.create({
      data: {
        messageId: message.id,
        ruleId: rule.id,
        decisionType: 'skip',
        destinations: [],
        body: message.body,
        mediaUrl: message.mediaUrl,
        status: 'completed',
        pipelineMode: opts.pipelineMode,
        reviewReason: opts.reason,
        stepLogs: opts.stepLogs as unknown as Prisma.InputJsonValue,
      },
    });

    this.logger.log(`Pipeline skip rule=${rule.id} message=${message.id}: ${opts.reason}`);

    return {
      action: 'skip',
      reason: opts.reason,
      pipelineMode: opts.pipelineMode,
      decisionId: decision.id,
    };
  }
}
=======
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Agent, Message, Prisma, Rule } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiService } from '../common/ai/ai.service';
import { getAiConfig } from '../common/ai/ai.config';
import { AgentRunContext } from '../common/ai/ai.types';
import { findChatByInboundJid } from '../common/whatsapp/inbound-chat-jid';
import {
  PipelineRunInput,
  PipelineRunResult,
  PipelineStepLog,
  PipelineMode,
} from './pipeline.types';

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  async runForRule(input: PipelineRunInput): Promise<PipelineRunResult> {
    const message = await this.prisma.message.findUnique({ where: { id: input.messageId } });
    if (!message) {
      throw new NotFoundException('Message not found for pipeline run');
    }

    const rule = await this.prisma.rule.findFirst({
      where: { id: input.ruleId, orgId: input.orgId, connectionId: input.connectionId },
    });
    if (!rule) {
      throw new NotFoundException('Rule not found for pipeline run');
    }

    if (!rule.pipelineAgentIds.length) {
      return this.finalizeForward(message, rule, input, {
        pipelineMode: 'passthrough',
        stepLogs: [{ agentId: '-', agentName: '-', agentType: '-', status: 'skipped_type', note: 'No pipeline agents' }],
        decisionType: 'forward',
        needsReview: false,
      });
    }

    const agents = await this.loadAgentsInOrder(input.orgId, rule.pipelineAgentIds);
    if (agents.length !== rule.pipelineAgentIds.length) {
      this.logger.warn(`Rule ${rule.id} has missing/inactive pipeline agents`);
      return this.finalizeForward(message, rule, input, {
        pipelineMode: 'fail_open',
        stepLogs: [
          {
            agentId: '-',
            agentName: '-',
            agentType: '-',
            status: 'error',
            error: 'One or more pipeline agents are missing or inactive',
          },
        ],
        decisionType: 'forward',
        errorDetails: 'Missing/inactive pipeline agents',
        needsReview: false,
      });
    }

    let context = await this.buildAgentContext(message, rule, input, rule.destinationChatIds);
    const stepLogs: PipelineStepLog[] = [];
    let body = message.body;
    let destinationChatIds = [...rule.destinationChatIds];
    const mediaUrl = message.mediaUrl;
    const type = message.type;
    let needsReview = false;

    for (const agent of agents) {
      const agentContext: AgentRunContext = {
        ...context,
        message: { ...context.message, body },
        destinationChats: this.buildDestinationChats(context, destinationChatIds),
      };

      if (agent.type === 'relevance') {
        const stop = await this.runRelevanceStep({
          agent,
          agentContext,
          rule,
          message,
          input,
          stepLogs,
          body,
          type,
          mediaUrl,
          destinationChatIds,
          onNeedsReview: () => {
            needsReview = true;
          },
        });
        if (stop) {
          return stop;
        }
        continue;
      }

      if (agent.type === 'clean') {
        const stop = await this.runCleanStep({
          agent,
          agentContext,
          rule,
          message,
          input,
          stepLogs,
          body,
          type,
          mediaUrl,
          destinationChatIds,
          onBodyUpdated: (nextBody) => {
            body = nextBody;
          },
        });
        if (stop) {
          return stop;
        }
        continue;
      }

      if (agent.type === 'route') {
        const stop = await this.runRouteStep({
          agent,
          agentContext,
          rule,
          message,
          input,
          stepLogs,
          body,
          type,
          mediaUrl,
          destinationChatIds,
          onDestinationsUpdated: (nextIds) => {
            destinationChatIds = nextIds;
          },
          onNeedsReview: () => {
            needsReview = true;
          },
        });
        if (stop) {
          return stop;
        }
        continue;
      }

      stepLogs.push({
        agentId: agent.id,
        agentName: agent.name,
        agentType: agent.type,
        status: 'skipped_type',
        note: `${agent.type} agent execution lands in a later sprint`,
      });
    }

    return this.finalizeForward(message, rule, input, {
      pipelineMode: 'executed',
      stepLogs,
      decisionType: 'forward',
      body,
      type,
      mediaUrl,
      destinationChatIds,
      needsReview,
    });
  }

  async getDecisionsForMessage(userId: string, messageId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const message = await this.prisma.message.findFirst({
      where: { id: messageId },
      select: { id: true, connectionId: true },
    });
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const connection = await this.prisma.whatsAppConnection.findFirst({
      where: { id: message.connectionId, orgId: user.organizationId },
      select: { id: true },
    });
    if (!connection) {
      throw new NotFoundException('Message not found');
    }

    return this.prisma.pipelineDecision.findMany({
      where: { messageId },
      orderBy: { createdAt: 'desc' },
      include: {
        rule: { select: { id: true, name: true } },
      },
    });
  }

  private async runRelevanceStep(opts: {
    agent: Agent;
    agentContext: AgentRunContext;
    rule: Rule;
    message: Message;
    input: PipelineRunInput;
    stepLogs: PipelineStepLog[];
    body: string | null;
    type: string;
    mediaUrl: string | null;
    destinationChatIds: string[];
    onNeedsReview: () => void;
  }): Promise<PipelineRunResult | null> {
    try {
      const result = await this.aiService.runRelevanceAgent(opts.agent, opts.agentContext);
      opts.stepLogs.push({
        agentId: opts.agent.id,
        agentName: opts.agent.name,
        agentType: opts.agent.type,
        status: 'completed',
        output: result,
      });

      if (!result.relevant) {
        return this.createSkipResult(opts.message, opts.rule, {
          pipelineMode: 'executed',
          reason: result.reason,
          stepLogs: opts.stepLogs,
        });
      }

      if (result.needsReview) {
        opts.onNeedsReview();
        opts.stepLogs[opts.stepLogs.length - 1].note = 'needsReview flagged for human review';
      }
      return null;
    } catch (err) {
      return this.handleAgentError(opts, err as Error, 'Relevance');
    }
  }

  private async runCleanStep(opts: {
    agent: Agent;
    agentContext: AgentRunContext;
    rule: Rule;
    message: Message;
    input: PipelineRunInput;
    stepLogs: PipelineStepLog[];
    body: string | null;
    type: string;
    mediaUrl: string | null;
    destinationChatIds: string[];
    onBodyUpdated: (body: string | null) => void;
  }): Promise<PipelineRunResult | null> {
    const textToClean = opts.body?.trim() || '';
    if (!textToClean) {
      opts.stepLogs.push({
        agentId: opts.agent.id,
        agentName: opts.agent.name,
        agentType: opts.agent.type,
        status: 'skipped_type',
        note: 'No text or caption to clean',
      });
      return null;
    }

    try {
      const result = await this.aiService.runCleanAgent(opts.agent, opts.agentContext);
      opts.stepLogs.push({
        agentId: opts.agent.id,
        agentName: opts.agent.name,
        agentType: opts.agent.type,
        status: 'completed',
        output: result,
      });

      opts.onBodyUpdated(result.cleanedText);
      this.logger.log(
        `Clean agent ${opts.agent.id} updated body for message ${opts.message.id} (${result.changes.length} change(s))`,
      );
      return null;
    } catch (err) {
      return this.handleAgentError(opts, err as Error, 'Clean');
    }
  }

  private async runRouteStep(opts: {
    agent: Agent;
    agentContext: AgentRunContext;
    rule: Rule;
    message: Message;
    input: PipelineRunInput;
    stepLogs: PipelineStepLog[];
    body: string | null;
    type: string;
    mediaUrl: string | null;
    destinationChatIds: string[];
    onDestinationsUpdated: (ids: string[]) => void;
    onNeedsReview: () => void;
  }): Promise<PipelineRunResult | null> {
    if (opts.destinationChatIds.length <= 1) {
      opts.stepLogs.push({
        agentId: opts.agent.id,
        agentName: opts.agent.name,
        agentType: opts.agent.type,
        status: 'skipped_type',
        note: 'Route agent skipped — only one destination configured',
      });
      return null;
    }

    try {
      const result = await this.aiService.runRouteAgent(
        opts.agent,
        opts.agentContext,
        opts.destinationChatIds,
      );
      opts.stepLogs.push({
        agentId: opts.agent.id,
        agentName: opts.agent.name,
        agentType: opts.agent.type,
        status: 'completed',
        output: result,
      });

      if (!result.destinationChatIds.length) {
        this.logger.warn(
          `Route agent ${opts.agent.id} selected no valid destinations for message ${opts.message.id} (check route agent returns chatId UUIDs, not group titles)`,
        );
        return this.createSkipResult(opts.message, opts.rule, {
          pipelineMode: 'executed',
          reason: result.reason || 'Route agent selected no destinations',
          stepLogs: opts.stepLogs,
        });
      }

      const { relevanceEscalationConfidence } = getAiConfig();
      if (result.confidence < relevanceEscalationConfidence) {
        opts.onNeedsReview();
        opts.stepLogs[opts.stepLogs.length - 1].note =
          'Route agent low confidence — flagged for human review on escalation';
      }

      const previousCount = opts.destinationChatIds.length;
      opts.onDestinationsUpdated(result.destinationChatIds);
      this.logger.log(
        `Route agent ${opts.agent.id} selected ${result.destinationChatIds.length}/${previousCount} destination(s) for message ${opts.message.id}`,
      );
      return null;
    } catch (err) {
      return this.handleAgentError(opts, err as Error, 'Route', opts.rule.destinationChatIds);
    }
  }

  private async handleAgentError(
    opts: {
      agent: Agent;
      rule: Rule;
      message: Message;
      input: PipelineRunInput;
      stepLogs: PipelineStepLog[];
      body: string | null;
      type: string;
      mediaUrl: string | null;
      destinationChatIds: string[];
    },
    err: Error,
    label: string,
    failOpenDestinationChatIds?: string[],
  ): Promise<PipelineRunResult | null> {
    const errorMessage = err.message;
    opts.stepLogs.push({
      agentId: opts.agent.id,
      agentName: opts.agent.name,
      agentType: opts.agent.type,
      status: 'error',
      error: errorMessage,
    });

    this.logger.warn(`${label} agent error — global fail-open forward for rule ${opts.rule.id}`);
    return this.finalizeForward(opts.message, opts.rule, opts.input, {
      pipelineMode: 'fail_open',
      stepLogs: opts.stepLogs,
      decisionType: 'forward',
      errorDetails: errorMessage,
      body: opts.body,
      type: opts.type,
      mediaUrl: opts.mediaUrl,
      destinationChatIds: failOpenDestinationChatIds ?? opts.destinationChatIds,
      needsReview: false,
    });
  }

  private async loadAgentsInOrder(orgId: string, agentIds: string[]): Promise<Agent[]> {
    const rows = await this.prisma.agent.findMany({
      where: { orgId, id: { in: agentIds }, isActive: true },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return agentIds.map((id) => byId.get(id)).filter((row): row is Agent => Boolean(row));
  }

  private async buildAgentContext(
    message: Message,
    rule: Rule,
    input: PipelineRunInput,
    destinationChatIds: string[],
  ): Promise<AgentRunContext & { _destinationChatRows?: Array<{ id: string; title: string | null; description: string | null; externalChatId: string; type: string }> }> {
    const chats = await this.prisma.chat.findMany({
      where: { connectionId: input.connectionId, connection: { orgId: input.orgId } },
      select: { id: true, externalChatId: true, title: true, description: true, type: true, metadata: true },
    });
    const sourceChat = findChatByInboundJid(chats, message.chatId);
    const destinationChats = this.buildDestinationChatsFromRows(chats, destinationChatIds);

    return {
      message: {
        body: message.body,
        type: message.type,
        sender: message.sender,
        chatId: message.chatId,
        mediaUrl: message.mediaUrl,
      },
      rule: {
        name: rule.name,
        description: rule.description,
      },
      sourceChat: sourceChat
        ? {
            title: sourceChat.title,
            description: sourceChat.description,
            externalChatId: sourceChat.externalChatId,
            type: String(sourceChat.type),
          }
        : undefined,
      destinationChats,
      _destinationChatRows: destinationChats,
    };
  }

  private buildDestinationChats(
    context: AgentRunContext & { _destinationChatRows?: Array<{ id: string; title: string | null; description: string | null; externalChatId: string; type: string }> },
    destinationChatIds: string[],
  ) {
    const rows = context._destinationChatRows ?? context.destinationChats ?? [];
    const byId = new Map(rows.map((row) => [row.id, row]));
    return destinationChatIds
      .map((id) => byId.get(id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  }

  private buildDestinationChatsFromRows(
    chats: Array<{ id: string; externalChatId: string; title: string | null; description: string | null; type: string }>,
    destinationChatIds: string[],
  ) {
    const byId = new Map(chats.map((chat) => [chat.id, chat]));
    return destinationChatIds
      .map((id) => byId.get(id))
      .filter((chat): chat is NonNullable<typeof chat> => Boolean(chat))
      .map((chat) => ({
        id: chat.id,
        title: chat.title,
        description: chat.description,
        externalChatId: chat.externalChatId,
        type: String(chat.type),
      }));
  }

  private shouldHoldForReview(rule: Rule, _pipelineMode: PipelineMode, needsReview: boolean): boolean {
    const mode = rule.reviewMode || 'on_escalation';
    if (mode === 'off') {
      return false;
    }
    if (mode === 'always') {
      return true;
    }
    return needsReview;
  }

  private buildReviewReason(rule: Rule, _pipelineMode: PipelineMode, needsReview: boolean): string {
    if (rule.reviewMode === 'always') {
      return 'Review required (review mode: always)';
    }
    if (needsReview) {
      return 'Agent flagged message for human review';
    }
    return 'Review required';
  }

  private async finalizeForward(
    message: Message,
    rule: Rule,
    input: PipelineRunInput,
    opts: {
      pipelineMode: PipelineMode;
      stepLogs: PipelineStepLog[];
      decisionType?: string;
      errorDetails?: string;
      body?: string | null;
      type?: string;
      mediaUrl?: string | null;
      destinationChatIds?: string[];
      needsReview?: boolean;
      reviewReasonOverride?: string;
    },
  ): Promise<PipelineRunResult> {
    const destinations = opts.destinationChatIds ?? rule.destinationChatIds;
    const body = opts.body ?? message.body;
    const type = opts.type ?? message.type;
    const mediaUrl = opts.mediaUrl ?? message.mediaUrl;
    const needsReview = opts.needsReview ?? false;

    if (this.shouldHoldForReview(rule, opts.pipelineMode, needsReview)) {
      return this.createReviewResult(message, rule, input, {
        pipelineMode: opts.pipelineMode,
        stepLogs: opts.stepLogs,
        body,
        type,
        mediaUrl,
        destinationChatIds: destinations,
        needsReview,
        reviewReasonOverride: opts.reviewReasonOverride,
      });
    }

    return this.createForwardResult(message, rule, {
      pipelineMode: opts.pipelineMode,
      stepLogs: opts.stepLogs,
      decisionType: opts.decisionType ?? 'forward',
      errorDetails: opts.errorDetails,
      body,
      type,
      mediaUrl,
      destinationChatIds: destinations,
    });
  }

  private async createReviewResult(
    message: Message,
    rule: Rule,
    input: PipelineRunInput,
    opts: {
      pipelineMode: PipelineMode;
      stepLogs: PipelineStepLog[];
      body: string | null;
      type: string;
      mediaUrl: string | null;
      destinationChatIds: string[];
      needsReview: boolean;
      reviewReasonOverride?: string;
    },
  ): Promise<PipelineRunResult> {
    const reviewReason =
      opts.reviewReasonOverride?.trim() ||
      this.buildReviewReason(rule, opts.pipelineMode, opts.needsReview);
    const expiresAt = new Date(Date.now() + rule.reviewTimeoutMinutes * 60_000);

    const decision = await this.prisma.pipelineDecision.create({
      data: {
        messageId: message.id,
        ruleId: rule.id,
        decisionType: 'review',
        destinations: opts.destinationChatIds,
        body: opts.body,
        mediaUrl: opts.mediaUrl,
        status: 'completed',
        pipelineMode: opts.pipelineMode,
        reviewReason,
        stepLogs: opts.stepLogs as unknown as Prisma.InputJsonValue,
      },
    });

    const payload = {
      connectionId: input.connectionId,
      body: opts.body,
      type: opts.type,
      mediaUrl: opts.mediaUrl,
      destinationChatIds: opts.destinationChatIds,
      pipelineMode: opts.pipelineMode,
      reviewReason,
      pipelineDecisionId: decision.id,
    };

    const reviewItem = await this.prisma.reviewItem.create({
      data: {
        messageId: message.id,
        ruleId: rule.id,
        status: 'pending',
        expiresAt,
        originalPayload: JSON.stringify(payload),
      },
    });

    this.logger.log(
      `Pipeline review queued rule=${rule.id} message=${message.id} reviewItem=${reviewItem.id}`,
    );

    return {
      action: 'review',
      reason: reviewReason,
      pipelineMode: opts.pipelineMode,
      decisionId: decision.id,
      reviewItemId: reviewItem.id,
      destinationChatIds: opts.destinationChatIds,
      body: opts.body,
      type: opts.type,
      mediaUrl: opts.mediaUrl,
    };
  }

  private async createForwardResult(
    message: Message,
    rule: Rule,
    opts: {
      pipelineMode: PipelineMode;
      stepLogs: PipelineStepLog[];
      decisionType: string;
      errorDetails?: string;
      body?: string | null;
      type?: string;
      mediaUrl?: string | null;
      destinationChatIds?: string[];
    },
  ): Promise<PipelineRunResult> {
    const destinations = opts.destinationChatIds ?? rule.destinationChatIds;
    const decision = await this.prisma.pipelineDecision.create({
      data: {
        messageId: message.id,
        ruleId: rule.id,
        decisionType: opts.decisionType,
        destinations,
        body: opts.body ?? message.body,
        mediaUrl: opts.mediaUrl ?? message.mediaUrl,
        status: 'completed',
        pipelineMode: opts.pipelineMode,
        stepLogs: opts.stepLogs as unknown as Prisma.InputJsonValue,
        errorDetails: opts.errorDetails ?? null,
      },
    });

    return {
      action: 'forward',
      destinationChatIds: destinations,
      body: opts.body ?? message.body,
      type: opts.type ?? message.type,
      mediaUrl: opts.mediaUrl ?? message.mediaUrl,
      pipelineMode: opts.pipelineMode,
      decisionId: decision.id,
    };
  }

  private async createSkipResult(
    message: Message,
    rule: Rule,
    opts: {
      pipelineMode: PipelineMode;
      reason: string;
      stepLogs: PipelineStepLog[];
    },
  ): Promise<PipelineRunResult> {
    const decision = await this.prisma.pipelineDecision.create({
      data: {
        messageId: message.id,
        ruleId: rule.id,
        decisionType: 'skip',
        destinations: [],
        body: message.body,
        mediaUrl: message.mediaUrl,
        status: 'completed',
        pipelineMode: opts.pipelineMode,
        reviewReason: opts.reason,
        stepLogs: opts.stepLogs as unknown as Prisma.InputJsonValue,
      },
    });

    this.logger.log(`Pipeline skip rule=${rule.id} message=${message.id}: ${opts.reason}`);

    return {
      action: 'skip',
      reason: opts.reason,
      pipelineMode: opts.pipelineMode,
      decisionId: decision.id,
    };
  }
}
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
