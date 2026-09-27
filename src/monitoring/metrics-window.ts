export type MetricsWindowConfig = {
  window: string;
  since: Date;
  intervalMs: number;
  intervalLabel: string;
};

export type TimeBucket = {
  bucket: string;
  label: string;
};

export function resolveMetricsWindow(window = '24h', now = new Date()): MetricsWindowConfig {
  const normalized = (window || '24h').toLowerCase();

  if (normalized === '1h') {
    return {
      window: '1h',
      since: new Date(now.getTime() - 60 * 60 * 1000),
      intervalMs: 15 * 60 * 1000,
      intervalLabel: '15m',
    };
  }

  if (normalized === '7d') {
    return {
      window: '7d',
      since: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      intervalMs: 24 * 60 * 60 * 1000,
      intervalLabel: '1d',
    };
  }

  return {
    window: '24h',
    since: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    intervalMs: 60 * 60 * 1000,
    intervalLabel: '1h',
  };
}

export function buildTimeBuckets(config: MetricsWindowConfig, now = new Date()): TimeBucket[] {
  const buckets: TimeBucket[] = [];
  const startMs = Math.floor(config.since.getTime() / config.intervalMs) * config.intervalMs;
  const endMs = now.getTime();

  for (let t = startMs; t <= endMs; t += config.intervalMs) {
    const date = new Date(t);
    buckets.push({
      bucket: date.toISOString(),
      label: formatBucketLabel(date, config.window),
    });
  }

  if (!buckets.length) {
    const date = new Date(startMs);
    buckets.push({
      bucket: date.toISOString(),
      label: formatBucketLabel(date, config.window),
    });
  }

  return buckets;
}

export function bucketIndexForTimestamp(
  buckets: TimeBucket[],
  timestamp: Date,
  intervalMs: number,
): number {
  if (!buckets.length) {
    return -1;
  }
  const ts = timestamp.getTime();
  const first = new Date(buckets[0].bucket).getTime();
  const last = new Date(buckets[buckets.length - 1].bucket).getTime();

  if (ts < first) {
    return 0;
  }
  if (ts >= last + intervalMs) {
    return buckets.length - 1;
  }

  const index = Math.floor((ts - first) / intervalMs);
  return Math.min(Math.max(index, 0), buckets.length - 1);
}

export function initForwardBuckets(buckets: TimeBucket[]) {
  return buckets.map((b) => ({
    bucket: b.bucket,
    label: b.label,
    sent: 0,
    failed: 0,
    pending: 0,
    capDeferred: 0,
  }));
}

export function initReviewBuckets(buckets: TimeBucket[]) {
  return buckets.map((b) => ({
    bucket: b.bucket,
    label: b.label,
    pending: 0,
    approved: 0,
    rejected: 0,
    autoForwarded: 0,
  }));
}

export function initPipelineBuckets(buckets: TimeBucket[]) {
  return buckets.map((b) => ({
    bucket: b.bucket,
    label: b.label,
    forward: 0,
    skip: 0,
    review: 0,
  }));
}

export function initInboundBuckets(buckets: TimeBucket[]) {
  return buckets.map((b) => ({
    bucket: b.bucket,
    label: b.label,
    count: 0,
  }));
}

function formatBucketLabel(date: Date, window: string): string {
  if (window === '7d') {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
