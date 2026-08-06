/** Display label + title extraction for synced WhatsApp chats. */

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

/** E.164-ish digits from a WhatsApp JID user part, or null if not a phone JID. */
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
  if (isSelfLabel(trimmed) && jid.includes('@lid')) {
    return false;
  }
  if (isOpaqueInternalId(trimmed, jid)) {
    return false;
  }
  return true;
}

function titleFieldPaths(chatType: ChatTypeLabel): string[] {
  // Groups/channels: WAHA overview uses `name`; NOWEB store `subject` can lag after phone renames.
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

function firstUsableTitleField(
  remote: Record<string, unknown>,
  jid: string,
  chatType: ChatTypeLabel,
): string | null {
  for (const path of titleFieldPaths(chatType)) {
    const value = readStringField(remote, path);
    if (value && isUsablePersonName(value, jid)) {
      return value;
    }
  }
  return null;
}

export function resolveChatTitleFromEvolutionPayload(
  remote: Record<string, unknown>,
  jid: string,
  chatType: ChatTypeLabel,
  contactName?: string | null,
): string {
  const altJid = readStringField(remote, 'remoteJidAlt');
  const canonicalJid =
    altJid && (altJid.endsWith('@s.whatsapp.net') || altJid.endsWith('@c.us')) ? altJid : jid;

  const fromPayload = firstUsableTitleField(remote, jid, chatType);

  if (fromPayload && isUsablePersonName(fromPayload, jid)) {
    if (isSelfLabel(fromPayload)) {
      return 'Message yourself';
    }
    return fromPayload;
  }

  if (contactName && isUsablePersonName(contactName, jid)) {
    if (isSelfLabel(contactName)) {
      return 'Message yourself';
    }
    return contactName;
  }

  const phone = phoneFromWhatsAppJid(canonicalJid) || phoneFromWhatsAppJid(jid);
  if (phone) {
    return phone;
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
    const fromMeta = resolveChatTitleFromEvolutionPayload(
      input.metadata as Record<string, unknown>,
      jid,
      chatType,
    );
    if (
      fromMeta !== 'Unknown chat' &&
      fromMeta !== 'Unnamed group' &&
      fromMeta !== 'Unnamed channel' &&
      isUsablePersonName(fromMeta, jid)
    ) {
      return fromMeta;
    }
  }

  if (input.title?.trim()) {
    const t = input.title.trim();
    if (isUsablePersonName(t, jid)) {
      if (isSelfLabel(t)) {
        return 'Message yourself';
      }
      return t;
    }
  }

  if (input.metadata && typeof input.metadata === 'object') {
    const fromMeta = resolveChatTitleFromEvolutionPayload(
      input.metadata as Record<string, unknown>,
      jid,
      chatType,
    );
    if (fromMeta !== 'Unknown chat') {
      return fromMeta;
    }
  }

  if (input.externalChatId) {
    const phone = phoneFromWhatsAppJid(input.externalChatId);
    if (phone) {
      return phone;
    }
  }

  if (input.externalChatId?.includes('@lid')) {
    return 'Unknown contact (LID)';
  }

  if (chatType === 'GROUP') {
    return 'Unnamed group';
  }
  if (chatType === 'CHANNEL') {
    return 'Unnamed channel';
  }

  return 'Unknown chat';
}
