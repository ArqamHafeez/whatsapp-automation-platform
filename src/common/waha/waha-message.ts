import { Logger } from '@nestjs/common';
import { getWahaConfig, wahaHeaders } from './waha.config';
import { resolveInboundChatJid } from '../whatsapp/inbound-chat-jid';

const logger = new Logger('WahaMedia');

export type ParsedIncomingMedia = {
  body: string;
  type: 'text' | 'image' | 'video' | 'document' | 'audio' | 'unknown';
  /** HTTP(S) URL, or data:...;base64,... for WAHA send endpoints */
  mediaUrl: string | null;
  mimeType: string | null;
};

const WHATSAPP_MEDIA_HOSTS = ['mmg.whatsapp.net', 'media.whatsapp.net'];

export function isHttpMediaUrl(mediaUrl: string): boolean {
  return /^https?:\/\//i.test(mediaUrl.trim());
}

/** True for URLs send endpoints can fetch directly (not WhatsApp encrypted CDN). */
export function isDirectHttpMediaUrl(mediaUrl: string): boolean {
  if (!isHttpMediaUrl(mediaUrl)) {
    return false;
  }
  try {
    const host = new URL(mediaUrl.trim()).hostname.toLowerCase();
    if (WHATSAPP_MEDIA_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
      return false;
    }
  } catch {
    return false;
  }
  return true;
}

function inferTypeFromMime(mime: string | null): ParsedIncomingMedia['type'] {
  if (!mime) {
    return 'unknown';
  }
  const m = mime.toLowerCase();
  if (m.startsWith('image/')) {
    return 'image';
  }
  if (m.startsWith('video/')) {
    return 'video';
  }
  if (m.startsWith('audio/')) {
    return 'audio';
  }
  if (m.startsWith('application/') || m.startsWith('text/')) {
    return 'document';
  }
  return 'unknown';
}

function pickUrl(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) {
      const trimmed = c.trim();
      if (trimmed.startsWith('data:') || /^https?:\/\//i.test(trimmed)) {
        return trimmed;
      }
    }
  }
  return null;
}

/**
 * Maps WAHA `message` webhook payload to normalized text + media fields.
 */
export function parseWahaIncomingMessage(payload: Record<string, unknown>): ParsedIncomingMedia {
  const body = typeof payload.body === 'string' ? payload.body : '';

  if (!payload.hasMedia) {
    return { body, type: body ? 'text' : 'unknown', mediaUrl: null, mimeType: null };
  }

  const media = payload.media as Record<string, unknown> | undefined;
  const mimeType =
    (typeof media?.mimetype === 'string' && media.mimetype) ||
    (typeof payload.mimetype === 'string' && payload.mimetype) ||
    null;

  const mediaUrl = pickUrl(payload.mediaUrl, media?.url, payload.url);

  let type = inferTypeFromMime(mimeType);
  if (type === 'unknown') {
    const filename = typeof media?.filename === 'string' ? media.filename.toLowerCase() : '';
    if (/\.(jpe?g|png|gif|webp)$/i.test(filename)) {
      type = 'image';
    } else if (/\.(mp4|mov|webm)$/i.test(filename)) {
      type = 'video';
    } else if (/\.(mp3|ogg|wav|m4a)$/i.test(filename)) {
      type = 'audio';
    } else if (mediaUrl) {
      type = 'document';
    }
  }

  return { body, type, mediaUrl, mimeType };
}

export function mediaNeedsWahaFetch(parsed: ParsedIncomingMedia): boolean {
  if (parsed.type === 'text' || parsed.type === 'unknown') {
    return false;
  }
  if (parsed.mediaUrl && (parsed.mediaUrl.startsWith('data:') || isDirectHttpMediaUrl(parsed.mediaUrl))) {
    return false;
  }
  return true;
}

/** Strip data URL to raw base64 for WAHA send when needed */
export function mediaPayloadForWahaSend(mediaUrl: string): string {
  const trimmed = mediaUrl.trim();
  if (trimmed.startsWith('data:')) {
    const comma = trimmed.indexOf(',');
    if (comma >= 0) {
      return trimmed.slice(comma + 1).replace(/\s/g, '');
    }
  }
  return trimmed;
}

export function isValidMediaDataUrl(mediaUrl: string): boolean {
  try {
    const payload = mediaPayloadForWahaSend(mediaUrl);
    if (payload.length < 16) {
      return false;
    }
    const buf = Buffer.from(payload, 'base64');
    if (buf.length < 12) {
      return false;
    }
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
      return true;
    }
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x53) {
      return true;
    }
    if (buf.toString('ascii', 0, 3) === 'GIF') {
      return true;
    }
    if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
      return true;
    }
    if (buf.length > 8 && buf.toString('ascii', 4, 8) === 'ftyp') {
      return true;
    }
    if (buf.toString('ascii', 0, 4) === '%PDF') {
      return true;
    }
    if (buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function rewriteWahaMediaUrl(url: string): string {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    const { baseUrl } = getWahaConfig();
    const wahaBase = new URL(baseUrl);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      parsed.hostname = wahaBase.hostname;
      parsed.port = wahaBase.port;
      parsed.protocol = wahaBase.protocol;
      return parsed.toString();
    }
  } catch {
    // keep original
  }
  return trimmed;
}

/** Fetch media bytes from WAHA file URL (adds API key when targeting WAHA host). */
export async function fetchWahaMediaDataUrl(
  mediaUrl: string,
  mimeHint: string | null,
): Promise<string | null> {
  const url = rewriteWahaMediaUrl(mediaUrl);
  const { baseUrl, apiKey } = getWahaConfig();

  try {
    const headers: Record<string, string> = {};
    if (url.startsWith(baseUrl)) {
      headers['X-Api-Key'] = apiKey;
    }

    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok) {
      logger.warn(`fetchWahaMedia HTTP ${res.status} for ${url.slice(0, 120)}`);
      return null;
    }

    const contentType = res.headers.get('content-type')?.split(';')[0].trim() || mimeHint || 'application/octet-stream';
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 12) {
      logger.warn(`fetchWahaMedia empty/small response (${buffer.length} bytes)`);
      return null;
    }

    const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
    if (!isValidMediaDataUrl(dataUrl)) {
      logger.warn(`fetchWahaMedia failed magic-byte check mime=${contentType}`);
      return null;
    }
    return dataUrl;
  } catch (err) {
    logger.warn(`fetchWahaMedia failed: ${(err as Error).message}`);
    return null;
  }
}

export async function fetchWahaMessageMedia(
  sessionName: string,
  chatId: string,
  messageId: string,
  mimeHint: string | null,
): Promise<string | null> {
  const { baseUrl, apiKey } = getWahaConfig();
  const url = `${baseUrl}/api/${encodeURIComponent(sessionName)}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}?downloadMedia=true`;

  try {
    const res = await fetch(url, {
      headers: wahaHeaders(apiKey),
      signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok) {
      logger.warn(`downloadMedia ${messageId} HTTP ${res.status}`);
      return null;
    }

    const body = (await res.json()) as Record<string, unknown>;
    const media = body.media as Record<string, unknown> | undefined;
    const mediaUrl = pickUrl(media?.url, body.mediaUrl);
    if (mediaUrl) {
      if (mediaUrl.startsWith('data:')) {
        return mediaUrl;
      }
      return fetchWahaMediaDataUrl(mediaUrl, mimeHint);
    }

    const b64 =
      (typeof body.base64 === 'string' && body.base64) ||
      (typeof media?.data === 'string' && media.data) ||
      null;
    if (b64?.trim()) {
      const mime =
        mimeHint ||
        (typeof media?.mimetype === 'string' ? media.mimetype : null) ||
        'application/octet-stream';
      return `data:${mime};base64,${b64.replace(/\s/g, '')}`;
    }

    return null;
  } catch (err) {
    logger.warn(`downloadMedia failed: ${(err as Error).message}`);
    return null;
  }
}

export async function resolveMediaUrlForForward(
  sessionName: string,
  messageType: string,
  mediaUrl: string | null,
  metadata: unknown,
  mimeHint: string | null,
): Promise<string | null> {
  if (mediaUrl?.startsWith('data:') && isValidMediaDataUrl(mediaUrl)) {
    return mediaUrl;
  }

  if (mediaUrl && isDirectHttpMediaUrl(mediaUrl)) {
    const fetched = await fetchWahaMediaDataUrl(mediaUrl, mimeHint);
    return fetched ?? mediaUrl;
  }

  const meta = metadata as Record<string, unknown> | null;
  const payload = (meta?.payload as Record<string, unknown> | undefined) ?? meta;
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const innerMediaUrl = pickUrl(
    payload.mediaUrl,
    (payload.media as Record<string, unknown> | undefined)?.url,
  );
  if (innerMediaUrl) {
    if (innerMediaUrl.startsWith('data:')) {
      return innerMediaUrl;
    }
    const fetched = await fetchWahaMediaDataUrl(innerMediaUrl, mimeHint);
    if (fetched) {
      return fetched;
    }
  }

  const chatId = resolveInboundChatJid(payload);
  const messageId = typeof payload.id === 'string' ? payload.id : null;

  if (sessionName && chatId && messageId) {
    return fetchWahaMessageMedia(sessionName, chatId, messageId, mimeHint);
  }

  return null;
}

export function mimeTypeFromMessageMetadata(metadata: unknown, messageType: string): string | null {
  const meta = metadata as Record<string, unknown> | null;
  const payload = (meta?.payload as Record<string, unknown> | undefined) ?? meta;
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const media = payload.media as { mimetype?: string } | undefined;
  if (typeof media?.mimetype === 'string') {
    return media.mimetype;
  }
  if (typeof payload.mimetype === 'string') {
    return payload.mimetype;
  }
  const defaults: Record<string, string> = {
    image: 'image/jpeg',
    video: 'video/mp4',
    audio: 'audio/ogg',
    document: 'application/pdf',
  };
  return defaults[messageType] ?? null;
}
