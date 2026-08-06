import { pickBoolean, pickString, pickStringArray } from './agent-json';

export interface CleanAgentResult {
  cleanedText: string;
  changes: string[];
  unchanged?: boolean;
}

export const CLEAN_JSON_SCHEMA_HINT = `{
  "cleanedText": string (required — cleaned message body),
  "changes": string[] (what was removed or changed),
  "unchanged": boolean (optional — true when no edits needed)
}`;

export function normalizeCleanParsed(
  parsed: Record<string, unknown>,
  originalText: string,
): CleanAgentResult {
  const cleanedText = pickString(parsed, [
    'cleanedText',
    'cleaned_text',
    'text',
    'output',
    'result',
    'body',
  ]);
  const changes = pickStringArray(parsed, ['changes', 'edits', 'modifications', 'removed']);
  const unchangedFlag = pickBoolean(parsed, ['unchanged', 'noChanges', 'no_changes']);
  const original = originalText.trim();
  const unchanged =
    unchangedFlag === true ||
    (!changes.length && cleanedText === original) ||
    (!cleanedText && !original);

  if (!cleanedText && original) {
    return {
      cleanedText: original,
      changes: [],
      unchanged: true,
    };
  }

  return {
    cleanedText,
    changes,
    unchanged,
  };
}

export function parseCleanResult(
  parsed: Record<string, unknown>,
  originalText: string,
): CleanAgentResult {
  return normalizeCleanParsed(parsed, originalText);
}
