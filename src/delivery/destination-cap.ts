export type DestinationCapConfig = {
  maxSendsPerHour: number | null;
  maxSendsPerDay: number | null;
};

export type CapDeferResult = {
  nextAttemptAt: Date;
  reason: string;
};

export type ChatCapSource = {
  maxSendsPerHour: number | null;
  maxSendsPerDay: number | null;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Pick caps from destination chat row(s); prefers any row that has caps configured. */
export function pickCapConfigFromChats(chats: ChatCapSource[]): DestinationCapConfig | null {
  if (!chats.length) {
    return null;
  }
  const row = chats.find((c) => c.maxSendsPerHour != null || c.maxSendsPerDay != null) ?? chats[0];
  const caps = { maxSendsPerHour: row.maxSendsPerHour, maxSendsPerDay: row.maxSendsPerDay };
  if (caps.maxSendsPerHour == null && caps.maxSendsPerDay == null) {
    return null;
  }
  return caps;
}

export function computeCapDefer(opts: {
  caps: DestinationCapConfig;
  sentCountLastHour: number;
  sentCountLastDay: number;
  reservedCount?: number;
  oldestSentAtInHour: Date | null;
  oldestSentAtInDay: Date | null;
  now?: Date;
}): CapDeferResult | null {
  const now = opts.now ?? new Date();
  const nowMs = now.getTime();
  const reserved = opts.reservedCount ?? 0;
  const hourUsage = opts.sentCountLastHour + reserved;
  const dayUsage = opts.sentCountLastDay + reserved;
  let deferUntilMs: number | null = null;
  let reason = '';

  if (opts.caps.maxSendsPerHour != null && hourUsage >= opts.caps.maxSendsPerHour) {
    const base = opts.oldestSentAtInHour?.getTime() ?? nowMs;
    deferUntilMs = base + HOUR_MS + 1000;
    reason = `Destination hourly cap (${opts.caps.maxSendsPerHour}/hour) reached`;
  }

  if (opts.caps.maxSendsPerDay != null && dayUsage >= opts.caps.maxSendsPerDay) {
    const base = opts.oldestSentAtInDay?.getTime() ?? nowMs;
    const dayDefer = base + DAY_MS + 1000;
    if (deferUntilMs == null || dayDefer > deferUntilMs) {
      deferUntilMs = dayDefer;
      reason = `Destination daily cap (${opts.caps.maxSendsPerDay}/day) reached`;
    }
  }

  if (deferUntilMs == null) {
    return null;
  }

  return {
    nextAttemptAt: new Date(deferUntilMs),
    reason,
  };
}
