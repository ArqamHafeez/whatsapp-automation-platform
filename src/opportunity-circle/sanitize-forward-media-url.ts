const MAX_HTTP_MEDIA_URL_LENGTH = 4096;

/**
 * OC ingest should not receive data: URLs; only short HTTPS links when available.
 */
export function sanitizeForwardMediaUrl(mediaUrl: string | null | undefined): string | null {
  if (mediaUrl == null) {
    return null;
  }
  const trimmed = mediaUrl.trim();
  if (!trimmed) {
    return null;
  }
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('data:')) {
    return null;
  }
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    if (trimmed.length > MAX_HTTP_MEDIA_URL_LENGTH) {
      return null;
    }
    return trimmed;
  }
  return null;
}
