import { RelevanceAgentResult } from './ai.types';

import { pickBoolean, pickConfidence, pickString } from './agent-json';



export const RELEVANCE_JSON_SCHEMA_HINT = `{

  "relevant": boolean (required),

  "reason": string (required — non-empty explanation),

  "confidence": number (0 to 1),

  "needsReview": boolean (optional),

  "detectedWatermark": boolean (optional — image messages only)

}`;



export function normalizeRelevanceParsed(parsed: Record<string, unknown>): RelevanceAgentResult {

  const relevantRaw = pickBoolean(parsed, ['relevant', 'isRelevant', 'is_relevant', 'shouldForward']);

  const relevant = relevantRaw ?? false;



  let reason = pickString(parsed, [

    'reason',

    'explanation',

    'rationale',

    'summary',

    'decision',

    'classification',

  ]);



  if (!reason) {

    reason = relevant

      ? 'Message matches forwarding criteria'

      : 'Message does not match forwarding criteria';

  }



  const confidence = pickConfidence(parsed, relevant ? 0.75 : 0.8);

  const needsReview = pickBoolean(parsed, ['needsReview', 'needs_review', 'review']) === true;

  const detectedWatermark =

    pickBoolean(parsed, ['detectedWatermark', 'detected_watermark', 'watermark']) === true;



  return { relevant, reason, confidence, needsReview, detectedWatermark };

}



export function parseRelevanceResult(parsed: Record<string, unknown>): RelevanceAgentResult {

  return normalizeRelevanceParsed(parsed);

}

