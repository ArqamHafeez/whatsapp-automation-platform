/** Client-side chat labels (mirrors backend chat-display helpers). */

function readStringField(obj: Record<string, unknown>, ...paths: string[]): string | null {
  for (const path of paths) {
    const parts = path.split('.');
    let cur: unknown = obj;
    for (const part of parts) {
      if (!cur || typeof cur !== 'object') {
        cur = undefined;
        break;
      }
      cur = (cur as Record<string, unknown>)[part];
    }
    if (typeof cur === 'string' && cur.trim()) {
      return cur.trim();
    }
  }
  return null;
}

export function phoneFromWhatsAppJid(jid: string): string | null {
  const trimmed = jid.trim();
  const at = trimmed.indexOf('@');
  if (at <= 0) {
    return null;
  }
  const domain = trimmed.slice(at + 1).toLowerCase();
  if (domain !== 's.whatsapp.net' && domain !== 'c.us') {
    return null;
  }
  const userPart = trimmed.slice(0, at).split(':')[0];
  if (!/^\d{6,15}$/.test(userPart)) {
    return null;
  }
  return `+${userPart}`;
}

type ChatTypeLabel = 'CHAT' | 'GROUP' | 'CHANNEL';

const SELF_LABELS = new Set(['você', 'voce', 'you', 'me']);

function isSelfLabel(name: string): boolean {
  return SELF_LABELS.has(name.trim().toLowerCase());
}

function isOpaqueInternalId(value: string, jid?: string): boolean {
  if (!/^\d+$/.test(value.trim())) {
    return false;
  }
  if (jid?.includes('@lid')) {
    return true;
  }
  if (value.length > 15) {
    return true;
  }
  return /^\d{14,}$/.test(value);
}

const PLACEHOLDER_TITLES = new Set([
  'unknown chat',
  'unknown contact (lid)',
  'unnamed group',
  'unnamed channel',
]);

function isUsablePersonName(name: string, jid: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) {
    return false;
  }
  if (PLACEHOLDER_TITLES.has(trimmed.toLowerCase())) {
    return false;
  }
  if (isOpaqueInternalId(trimmed, jid)) {
    return false;
  }
  if (isSelfLabel(trimmed) && jid.includes('@lid')) {
    return false;
  }
  return true;
}

function titleFieldPaths(chatType: ChatTypeLabel): string[] {
  if (chatType === 'GROUP' || chatType === 'CHANNEL') {
    return [
      'name',
      'subject',
      'formattedTitle',
      '_chat.name',
      '_chat.subject',
      'pushName',
      'verifiedName',
      'notify',
      'contact.name',
      'lastMessage.pushName',
    ];
  }

  return [
    'subject',
    'pushName',
    'name',
    'verifiedName',
    'notify',
    'formattedTitle',
    'contact.name',
    'lastMessage.pushName',
  ];
}

function resolveFromMetadata(
  metadata: Record<string, unknown>,
  jid: string,
  chatType: ChatTypeLabel,
): string | null {
  for (const path of titleFieldPaths(chatType)) {
    const value = readStringField(metadata, path);
    if (value && isUsablePersonName(value, jid)) {
      return isSelfLabel(value) ? 'Message yourself' : value;
    }
  }
  return null;
}

export function formatChatDisplayLabel(input: {
  title?: string | null;
  externalChatId?: string | null;
  type?: string | null;
  metadata?: unknown;
}): string {
  const chatType: ChatTypeLabel =
    input.type?.toUpperCase() === 'GROUP'
      ? 'GROUP'
      : input.type?.toUpperCase() === 'CHANNEL'
        ? 'CHANNEL'
        : 'CHAT';

  const jid = input.externalChatId || '';

  if (input.metadata && typeof input.metadata === 'object' && (chatType === 'GROUP' || chatType === 'CHANNEL')) {
    const fromMeta = resolveFromMetadata(input.metadata as Record<string, unknown>, jid, chatType);
    if (fromMeta) {
      return fromMeta;
    }
  }

  if (input.title?.trim() && isUsablePersonName(input.title, jid)) {
    return isSelfLabel(input.title) ? 'Message yourself' : input.title.trim();
  }

  if (input.metadata && typeof input.metadata === 'object') {
    const meta = input.metadata as Record<string, unknown>;
    const alt = typeof meta.remoteJidAlt === 'string' ? meta.remoteJidAlt : jid;
    const canonical =
      alt.endsWith('@s.whatsapp.net') || alt.endsWith('@c.us') ? alt : jid;
    const fromMeta = resolveFromMetadata(meta, canonical, chatType);
    if (fromMeta) {
      return fromMeta;
    }
    const phone = phoneFromWhatsAppJid(canonical) || phoneFromWhatsAppJid(jid);
    if (phone) {
      return phone;
    }
  }

  if (jid) {
    const phone = phoneFromWhatsAppJid(jid);
    if (phone) {
      return phone;
    }
  }

  if (chatType === 'GROUP') {
    return 'Unnamed group';
  }
  if (chatType === 'CHANNEL') {
    return 'Unnamed channel';
  }
  if (jid.includes('@lid')) {
    return 'Unknown contact (LID)';
  }

  return 'Unknown chat';
}

export function chatMatchesSearch(
  chat: {
    title?: string | null;
    externalChatId?: string | null;
    type?: string | null;
    metadata?: unknown;
  },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  const label = formatChatDisplayLabel(chat).toLowerCase();
  const jid = (chat.externalChatId || '').toLowerCase();
  return label.includes(q) || jid.includes(q);
}
