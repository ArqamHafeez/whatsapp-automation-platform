import { getAiConfig } from './ai.config';
import { RelevanceAgentResult } from './ai.types';

/** Spec §4: on_escalation holds only for agent-flagged uncertainty — no hardcoded domain rules. */
export function applyRelevanceEscalationHints(
  result: RelevanceAgentResult,
): RelevanceAgentResult {
  const { relevanceEscalationConfidence } = getAiConfig();

  if (result.detectedWatermark) {
    return {
      ...result,
      needsReview: true,
      reason: `${result.reason} (detected image watermark — human review required)`,
    };
  }

  if (result.relevant && result.confidence < relevanceEscalationConfidence && !result.needsReview) {
    return {
      ...result,
      needsReview: true,
      reason: `${result.reason} (low confidence — flagged for review)`,
    };
  }

  return result;
}
