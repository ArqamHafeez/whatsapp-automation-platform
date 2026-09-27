import { phoneFromWhatsAppJid } from './chat-display';

/** Prefer phone-based JID for storage so webhooks and rules align with Evolution LID changes. */
export function resolveCanonicalChatJid(
  remote: Record<string, unknown>,
  remoteJid: string,
): string {
  const candidates: string[] = [];

  const push = (value: unknown) => {
    if (typeof value === 'string' && value.includes('@')) {
      candidates.push(value);
    }
  };

  push(remote.remoteJidAlt);
  push(remote.lastRemoteJid);
  const lastMessage = remote.lastMessage as Record<string, unknown> | undefined;
  const lastKey = lastMessage?.key as Record<string, unknown> | undefined;
  push(lastKey?.remoteJidAlt);
  push((remote.key as Record<string, unknown> | undefined)?.remoteJidAlt);

  push(remoteJid);

  for (const jid of candidates) {
    if (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@c.us')) {
      return jid;
    }
  }

  for (const jid of candidates) {
    if (jid.endsWith('@g.us') || jid.endsWith('@newsletter')) {
      return jid;
    }
  }

  return remoteJid;
}

export function digitsFromPhoneJid(jid: string): string | null {
  const phone = phoneFromWhatsAppJid(jid);
  return phone ? phone.replace(/^\+/, '') : null;
}
