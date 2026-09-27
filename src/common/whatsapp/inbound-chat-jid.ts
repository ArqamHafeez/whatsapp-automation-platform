import { normalizeWhatsAppJid, whatsAppJidsMatch } from './jid-match';

function pushJid(out: string[], value: unknown): void {
  if (typeof value === 'string' && value.includes('@')) {
    out.push(value.trim());
  }
}

/** Collect every JID-like field WAHA may send on an inbound message webhook. */
export function collectInboundJidCandidates(msgData: Record<string, unknown>): string[] {
  const out: string[] = [];

  pushJid(out, msgData.chatId);
  pushJid(out, msgData.from);
  pushJid(out, msgData.to);
  pushJid(out, msgData.participant);
  pushJid(out, msgData.author);

  const data = msgData._data as Record<string, unknown> | undefined;
  if (data) {
    const key = data.key as Record<string, unknown> | undefined;
    pushJid(out, key?.remoteJid);
    pushJid(out, key?.remoteJidAlt);
    pushJid(out, key?.participant);
    pushJid(out, data.remoteJid);
    pushJid(out, data.remoteJidAlt);
  }

  return [...new Set(out)];
}

/**
 * Pick the chat JID that represents the conversation (group / channel / DM),
 * not the participant sender inside a group.
 */
export function resolveInboundChatJid(msgData: Record<string, unknown>): string | undefined {
  const candidates = collectInboundJidCandidates(msgData);
  if (!candidates.length) {
    return undefined;
  }

  for (const jid of candidates) {
    if (jid.endsWith('@g.us') || jid.endsWith('@newsletter')) {
      return jid;
    }
  }

  for (const jid of candidates) {
    if (jid.endsWith('@c.us')) {
      return jid;
    }
  }

  for (const jid of candidates) {
    if (jid.endsWith('@s.whatsapp.net')) {
      return normalizeWhatsAppJid(jid);
    }
  }

  for (const jid of candidates) {
    if (jid.endsWith('@lid')) {
      return jid;
    }
  }

  return candidates[0];
}

export function collectRemoteJidAliases(
  remote: Record<string, unknown>,
  primaryJid: string,
  storedJid: string,
): string[] {
  const aliases = new Set<string>([primaryJid, storedJid]);

  const push = (value: unknown) => {
    if (typeof value === 'string' && value.includes('@')) {
      aliases.add(value.trim());
    }
  };

  push(remote.remoteJidAlt);
  push(remote.lastRemoteJid);
  push(remote.id);
  push(remote.chatId);
  push(remote.jid);

  const lastMessage = remote.lastMessage as Record<string, unknown> | undefined;
  const lastKey = lastMessage?.key as Record<string, unknown> | undefined;
  push(lastKey?.remoteJid);
  push(lastKey?.remoteJidAlt);
  push((remote.key as Record<string, unknown> | undefined)?.remoteJid);
  push((remote.key as Record<string, unknown> | undefined)?.remoteJidAlt);

  const existing = remote.alternateJids;
  if (Array.isArray(existing)) {
    for (const item of existing) {
      push(item);
    }
  }

  return [...aliases];
}

export function chatJidAliases(chat: { externalChatId: string; metadata?: unknown }): string[] {
  const aliases = new Set<string>([chat.externalChatId]);
  const meta = chat.metadata as Record<string, unknown> | null;

  if (meta) {
    const push = (value: unknown) => {
      if (typeof value === 'string' && value.includes('@')) {
        aliases.add(value.trim());
      }
    };

    push(meta.sourceRemoteJid);
    push(meta.canonicalRemoteJid);

    const alternateJids = meta.alternateJids;
    if (Array.isArray(alternateJids)) {
      for (const item of alternateJids) {
        push(item);
      }
    }
  }

  return [...aliases];
}

export function inboundJidMatchesChat(
  inboundJid: string,
  chat: { externalChatId: string; metadata?: unknown },
): boolean {
  for (const alias of chatJidAliases(chat)) {
    if (whatsAppJidsMatch(alias, inboundJid)) {
      return true;
    }
  }
  return false;
}

export function findChatByInboundJid<T extends { externalChatId: string; metadata?: unknown }>(
  chats: T[],
  inboundJid: string,
): T | undefined {
  return chats.find((chat) => inboundJidMatchesChat(inboundJid, chat));
}

/** All synced chat rows for the same conversation (e.g. @c.us vs @s.whatsapp.net duplicates). */
export function findAllChatsByInboundJid<T extends { id: string; externalChatId: string; metadata?: unknown }>(
  chats: T[],
  inboundJid: string,
): T[] {
  const seen = new Set<string>();
  const matches: T[] = [];
  for (const chat of chats) {
    if (seen.has(chat.id)) {
      continue;
    }
    if (inboundJidMatchesChat(inboundJid, chat)) {
      seen.add(chat.id);
      matches.push(chat);
    }
  }
  return matches;
}
