import {
  buildTimeBuckets,
  bucketIndexForTimestamp,
  resolveMetricsWindow,
} from './metrics-window';

describe('metrics-window', () => {
  const now = new Date('2026-08-06T12:00:00.000Z');

  it('resolves 24h window with hourly buckets', () => {
    const config = resolveMetricsWindow('24h', now);
    expect(config.window).toBe('24h');
    expect(config.intervalLabel).toBe('1h');
    expect(config.since.toISOString()).toBe('2026-08-05T12:00:00.000Z');
  });

  it('builds aligned buckets for 1h window', () => {
    const config = resolveMetricsWindow('1h', now);
    const buckets = buildTimeBuckets(config, now);
    expect(buckets.length).toBeGreaterThan(0);
    expect(buckets[0].bucket).toBeTruthy();
  });

  it('maps timestamps into bucket indexes', () => {
    const config = resolveMetricsWindow('24h', now);
    const buckets = buildTimeBuckets(config, now);
    const idx = bucketIndexForTimestamp(buckets, new Date('2026-08-06T11:30:00.000Z'), config.intervalMs);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(buckets.length);
  });
});
