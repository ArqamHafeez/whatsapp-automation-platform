/** Normalize WhatsApp JIDs for rule matching (device suffix, case). */
export function normalizeWhatsAppJid(jid: string): string {
  const trimmed = jid.trim().toLowerCase();
  const at = trimmed.indexOf('@');
  if (at <= 0) {
    return trimmed;
  }
  const userPart = trimmed.slice(0, at).split(':')[0];
  const domain = trimmed.slice(at + 1);
  if (domain === 's.whatsapp.net' || domain === 'c.us') {
    return `${userPart}@c.us`;
  }
  return `${userPart}@${domain}`;
}

export function whatsAppJidsMatch(stored: string, incoming: string): boolean {
  if (stored === incoming) {
    return true;
  }
  return normalizeWhatsAppJid(stored) === normalizeWhatsAppJid(incoming);
}
