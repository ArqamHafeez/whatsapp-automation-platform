import { computeCapDefer, pickCapConfigFromChats } from './destination-cap';

describe('pickCapConfigFromChats', () => {
  it('returns null when no chats', () => {
    expect(pickCapConfigFromChats([])).toBeNull();
  });

  it('prefers a row that has caps configured', () => {
    expect(
      pickCapConfigFromChats([
        { maxSendsPerHour: null, maxSendsPerDay: null },
        { maxSendsPerHour: 1, maxSendsPerDay: 2 },
      ]),
    ).toEqual({ maxSendsPerHour: 1, maxSendsPerDay: 2 });
  });
});

describe('computeCapDefer', () => {
  const now = new Date('2026-08-06T12:00:00.000Z');

  it('returns null when no caps configured', () => {
    expect(
      computeCapDefer({
        caps: { maxSendsPerHour: null, maxSendsPerDay: null },
        sentCountLastHour: 100,
        sentCountLastDay: 100,
        oldestSentAtInHour: now,
        oldestSentAtInDay: now,
        now,
      }),
    ).toBeNull();
  });

  it('defers when hourly cap is reached', () => {
    const oldest = new Date('2026-08-06T11:30:00.000Z');
    const result = computeCapDefer({
      caps: { maxSendsPerHour: 5, maxSendsPerDay: null },
      sentCountLastHour: 5,
      sentCountLastDay: 5,
      oldestSentAtInHour: oldest,
      oldestSentAtInDay: oldest,
      now,
    });

    expect(result?.reason).toContain('hourly cap');
    expect(result?.nextAttemptAt.toISOString()).toBe('2026-08-06T12:30:01.000Z');
  });

  it('defers until daily window when daily cap is stricter', () => {
    const oldestHour = new Date('2026-08-06T11:50:00.000Z');
    const oldestDay = new Date('2026-08-05T14:00:00.000Z');
    const result = computeCapDefer({
      caps: { maxSendsPerHour: 10, maxSendsPerDay: 20 },
      sentCountLastHour: 10,
      sentCountLastDay: 20,
      oldestSentAtInHour: oldestHour,
      oldestSentAtInDay: oldestDay,
      now,
    });

    expect(result?.reason).toContain('daily cap');
    expect(result?.nextAttemptAt.toISOString()).toBe('2026-08-06T14:00:01.000Z');
  });

  it('allows send when under caps', () => {
    expect(
      computeCapDefer({
        caps: { maxSendsPerHour: 5, maxSendsPerDay: 20 },
        sentCountLastHour: 4,
        sentCountLastDay: 19,
        oldestSentAtInHour: now,
        oldestSentAtInDay: now,
        now,
      }),
    ).toBeNull();
  });

  it('defers when in-flight reserved slots fill the hourly cap', () => {
    const result = computeCapDefer({
      caps: { maxSendsPerHour: 1, maxSendsPerDay: null },
      sentCountLastHour: 0,
      sentCountLastDay: 0,
      reservedCount: 1,
      oldestSentAtInHour: null,
      oldestSentAtInDay: null,
      now,
    });

    expect(result?.reason).toContain('hourly cap');
  });
});
