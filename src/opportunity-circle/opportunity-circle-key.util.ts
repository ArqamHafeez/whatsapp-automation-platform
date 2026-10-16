import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export function hashOpportunityCircleKey(rawKey: string): string {
  return createHash('sha256').update(rawKey, 'utf8').digest('hex');
}

export function generateOpportunityCircleKey(): string {
  return `oc_${randomBytes(24).toString('base64url')}`;
}

export function keysMatch(storedHash: string | null | undefined, providedKey: string): boolean {
  if (!storedHash || !providedKey) {
    return false;
  }
  const providedHash = hashOpportunityCircleKey(providedKey);
  try {
    const a = Buffer.from(storedHash, 'hex');
    const b = Buffer.from(providedHash, 'hex');
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export type ForwardsCursor = { sentAt: string; messageId: string };

export function encodeForwardsCursor(cursor: ForwardsCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeForwardsCursor(raw?: string | null): ForwardsCursor | null {
  if (!raw?.trim()) {
    return null;
  }
  const trimmed = raw.trim();
  try {
    const json = Buffer.from(trimmed, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as ForwardsCursor;
    if (parsed?.sentAt && parsed?.messageId) {
      return parsed;
    }
  } catch {
    // Legacy: Opportunity Circle mock used bare messageId as cursor
    return { sentAt: '1970-01-01T00:00:00.000Z', messageId: trimmed };
  }
  return null;
}
