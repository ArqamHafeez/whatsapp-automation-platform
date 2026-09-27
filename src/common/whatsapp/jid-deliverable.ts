<<<<<<< HEAD
/** JIDs that WAHA can send to. LID chat IDs are valid WAHA destinations. */
=======
/** JIDs that WAHA can send to (exclude invalid / LID-only rows). */
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
export function isDeliverableWhatsAppJid(jid: string): boolean {
  const trimmed = jid?.trim();
  if (!trimmed || !trimmed.includes('@')) {
    return false;
  }
  const [userPart, domain] = trimmed.split('@');
  if (!userPart || !domain) {
    return false;
  }
  const user = userPart.split(':')[0];
  if (domain === 's.whatsapp.net' || domain === 'c.us') {
    if (!/^\d{6,15}$/.test(user)) {
      return false;
    }
    if (user === '0') {
      return false;
    }
    return true;
  }
  if (domain === 'g.us') {
    return user.length >= 8;
  }
<<<<<<< HEAD
  if (domain === 'lid') {
    return /^\d{6,20}$/.test(user);
  }
=======
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
  if (domain === 'newsletter') {
    return user.length >= 8;
  }
  return false;
}

export function toWahaChatId(jid: string): string {
  const trimmed = jid.trim();
  const at = trimmed.indexOf('@');
  if (at <= 0) {
    return trimmed;
  }
  const userPart = trimmed.slice(0, at).split(':')[0];
  const domain = trimmed.slice(at + 1).toLowerCase();
  if (domain === 's.whatsapp.net') {
    return `${userPart}@c.us`;
  }
  return trimmed;
}

/** @deprecated Use toWahaChatId */
export function evolutionSendNumber(jid: string): string {
  return toWahaChatId(jid);
}
