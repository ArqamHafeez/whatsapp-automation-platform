import { Injectable, Logger } from '@nestjs/common';
import { Agent } from '@prisma/client';
import { createAiProvider, AiProviderError } from './ai-provider';
import { AgentRunContext, RelevanceAgentResult, RouteAgentResult } from './ai.types';
import {
  buildAgentPrompts,
  buildDefaultCleanUserPrompt,
  buildDefaultRelevanceUserPrompt,
  buildDefaultRouteUserPrompt,
} from './prompt-builder';
import { parseCleanResult, CLEAN_JSON_SCHEMA_HINT, CleanAgentResult } from './clean.schema';
import { parseRelevanceResult, RELEVANCE_JSON_SCHEMA_HINT } from './relevance.schema';
import { applyRelevanceEscalationHints } from './relevance-heuristics';
import { parseRouteResult, ROUTE_JSON_SCHEMA_HINT } from './route.schema';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly provider = createAiProvider();

  async runRelevanceAgent(agent: Agent, context: AgentRunContext): Promise<RelevanceAgentResult> {
    const defaultUserPrompt = buildDefaultRelevanceUserPrompt(context);
    const { systemPrompt, userPrompt } = buildAgentPrompts(agent, context, defaultUserPrompt);
    const useVision =
      context.message.type === 'image' &&
      Boolean(context.message.mediaUrl?.startsWith('data:image/'));

    try {
      const completion = await this.provider.completeStructured({
        systemPrompt,
        userPrompt,
        model: agent.model,
        schemaHint: RELEVANCE_JSON_SCHEMA_HINT,
        taskKind: 'relevance',
        imageDataUrl: useVision ? context.message.mediaUrl : null,
      });

      const parsed = parseRelevanceResult(completion.parsed);
      return applyRelevanceEscalationHints(parsed);
    } catch (err) {
      this.logger.error(`Relevance agent failed (${agent.id}): ${(err as Error).message}`);
      if (err instanceof AiProviderError) {
        throw err;
      }
      throw new AiProviderError((err as Error).message);
    }
  }

  async runCleanAgent(agent: Agent, context: AgentRunContext): Promise<CleanAgentResult> {
    const originalText = context.message.body?.trim() || '';
    const defaultUserPrompt = buildDefaultCleanUserPrompt(context);
    const { systemPrompt, userPrompt } = buildAgentPrompts(agent, context, defaultUserPrompt);

    try {
      const completion = await this.provider.completeStructured({
        systemPrompt,
        userPrompt,
        model: agent.model,
        schemaHint: CLEAN_JSON_SCHEMA_HINT,
        taskKind: 'clean',
      });

      return parseCleanResult(completion.parsed, originalText);
    } catch (err) {
      this.logger.error(`Clean agent failed (${agent.id}): ${(err as Error).message}`);
      if (err instanceof AiProviderError) {
        throw err;
      }
      throw new AiProviderError((err as Error).message);
    }
  }

  async runRouteAgent(
    agent: Agent,
    context: AgentRunContext,
    allowedDestinationIds: string[],
  ): Promise<RouteAgentResult> {
    const defaultUserPrompt = buildDefaultRouteUserPrompt(context);
    const { systemPrompt, userPrompt } = buildAgentPrompts(agent, context, defaultUserPrompt);

    try {
      const completion = await this.provider.completeStructured({
        systemPrompt,
        userPrompt,
        model: agent.model,
        schemaHint: ROUTE_JSON_SCHEMA_HINT,
        taskKind: 'route',
      });

      return parseRouteResult(
        completion.parsed,
        allowedDestinationIds,
        (context.destinationChats ?? []).map((chat) => ({
          id: chat.id,
          title: chat.title,
        })),
      );
    } catch (err) {
      this.logger.error(`Route agent failed (${agent.id}): ${(err as Error).message}`);
      if (err instanceof AiProviderError) {
        throw err;
      }
      throw new AiProviderError((err as Error).message);
    }
  }
}
