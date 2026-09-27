/** Extract and normalize JSON objects from LLM text (handles markdown fences and wrappers). */
export function extractJsonObject(rawText: string): Record<string, unknown> {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('empty completion');
  }

  const attempts = [trimmed];
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    attempts.unshift(fenceMatch[1].trim());
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    attempts.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  let lastError: Error | null = null;
  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return flattenAgentJson(parsed as Record<string, unknown>);
      }
    } catch (err) {
      lastError = err as Error;
    }
  }

  throw lastError ?? new Error('non-JSON content');
}

/** Some models nest output under result/data/response. */
function flattenAgentJson(parsed: Record<string, unknown>): Record<string, unknown> {
  for (const key of ['result', 'data', 'response', 'output']) {
    const nested = parsed[key];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return { ...parsed, ...(nested as Record<string, unknown>) };
    }
  }
  return parsed;
}

export function pickString(
  parsed: Record<string, unknown>,
  keys: string[],
): string {
  for (const key of keys) {
    const value = parsed[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

export function pickBoolean(parsed: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = parsed[key];
    if (value === true || value === 'true' || value === 1 || value === '1') {
      return true;
    }
    if (value === false || value === 'false' || value === 0 || value === '0') {
      return false;
    }
  }
  return undefined;
}

export function pickStringArray(parsed: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = parsed[key];
    if (!Array.isArray(value)) {
      continue;
    }
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }
  return [];
}

export function pickNumber(parsed: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = parsed[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const num = Number(value);
      if (Number.isFinite(num)) {
        return num;
      }
    }
  }
  return undefined;
}

export function pickConfidence(parsed: Record<string, unknown>, fallback: number): number {
  const keys = ['confidence', 'score', 'certainty'];
  for (const key of keys) {
    const value = parsed[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.min(1, Math.max(0, value));
    }
    if (typeof value === 'string') {
      const num = Number(value);
      if (Number.isFinite(num)) {
        return Math.min(1, Math.max(0, num));
      }
    }
  }
  return fallback;
}

export const AGENT_JSON_REQUIREMENTS =
  'Return ONE JSON object only. Do not wrap in markdown. The "reason" field MUST be a non-empty string explaining your decision.';
