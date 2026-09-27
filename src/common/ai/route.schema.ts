import { RouteAgentResult } from './ai.types';
import { pickConfidence, pickString, pickStringArray } from './agent-json';

export type RouteDestinationOption = {
  id: string;
  title: string | null;
};

export const ROUTE_JSON_SCHEMA_HINT = `{
  "destinationChatIds": string[] (required — use exact chatId UUIDs from the destination list, NOT titles),
  "reason": string (required — non-empty explanation),
  "confidence": number (0 to 1, optional)
}`;

function pickLooseStringValues(parsed: Record<string, unknown>, keys: string[]): string[] {
  const values: string[] = [];
  for (const key of keys) {
    const value = parsed[key];
    if (typeof value === 'string' && value.trim()) {
      values.push(value.trim());
    }
  }
  return values;
}

function resolveDestinationId(
  candidate: string,
  allowed: Set<string>,
  destinations: RouteDestinationOption[],
): string | null {
  if (allowed.has(candidate)) {
    return candidate;
  }

  const normalized = candidate.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  for (const dest of destinations) {
    const title = dest.title?.trim().toLowerCase();
    if (!title) {
      continue;
    }
    if (title === normalized || title.includes(normalized) || normalized.includes(title)) {
      return dest.id;
    }
  }

  return null;
}

export function normalizeRouteParsed(
  parsed: Record<string, unknown>,
  allowedIds: string[],
  destinations: RouteDestinationOption[] = [],
): RouteAgentResult {
  const allowed = new Set(allowedIds);
  const rawIds = [
    ...pickStringArray(parsed, [
      'destinationChatIds',
      'destination_chat_ids',
      'destinationIds',
      'destination_ids',
      'chatIds',
      'chat_ids',
    ]),
    ...pickLooseStringValues(parsed, [
      'destination',
      'destinationTitle',
      'destination_title',
      'destinationName',
      'destination_name',
      'selectedDestination',
    ]),
  ];

  const destinationsField = parsed.destinations;
  if (Array.isArray(destinationsField)) {
    for (const item of destinationsField) {
      if (typeof item === 'string' && item.trim()) {
        rawIds.push(item.trim());
        continue;
      }
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const obj = item as Record<string, unknown>;
        for (const key of ['id', 'chatId', 'destinationChatId', 'title', 'name']) {
          if (typeof obj[key] === 'string' && obj[key]!.trim()) {
            rawIds.push((obj[key] as string).trim());
          }
        }
      }
    }
  }

  const seen = new Set<string>();
  const destinationChatIds: string[] = [];
  for (const item of rawIds) {
    const resolved = resolveDestinationId(item, allowed, destinations);
    if (!resolved || seen.has(resolved)) {
      continue;
    }
    seen.add(resolved);
    destinationChatIds.push(resolved);
  }

  let reason = pickString(parsed, ['reason', 'explanation', 'rationale', 'summary', 'routingReason']);
  if (!reason) {
    reason =
      destinationChatIds.length > 0
        ? `Selected ${destinationChatIds.length} destination(s)`
        : 'No matching destination for this message';
  }

  const confidence = pickConfidence(parsed, destinationChatIds.length > 0 ? 0.75 : 0.5);

  return { destinationChatIds, reason, confidence };
}

export function parseRouteResult(
  parsed: Record<string, unknown>,
  allowedIds: string[],
  destinations: RouteDestinationOption[] = [],
): RouteAgentResult {
  return normalizeRouteParsed(parsed, allowedIds, destinations);
}
