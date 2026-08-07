import { pickBoolean, pickNumber } from '../ai/agent-json';

export type NormalizedRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
};

export type WatermarkLocateResult = {
  hasWatermark: boolean;
  confidence: number;
  regions: NormalizedRegion[];
  reason: string;
};

export const WATERMARK_LOCATE_SCHEMA_HINT = `{
  "hasWatermark": boolean,
  "confidence": number (0-1),
  "reason": string,
  "regions": [
    {
      "x": number (0-1 left),
      "y": number (0-1 top),
      "width": number (0-1),
      "height": number (0-1),
      "label": string (optional)
    }
  ]
}`;

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function parseRegion(raw: unknown): NormalizedRegion | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const x = pickNumber(row, ['x', 'left']);
  const y = pickNumber(row, ['y', 'top']);
  const width = pickNumber(row, ['width', 'w']);
  const height = pickNumber(row, ['height', 'h']);
  if (x == null || y == null || width == null || height == null) return null;
  const nx = clamp01(x);
  const ny = clamp01(y);
  const nw = clamp01(width);
  const nh = clamp01(height);
  if (nw <= 0 || nh <= 0) return null;
  const label = typeof row.label === 'string' ? row.label.trim() : undefined;
  return { x: nx, y: ny, width: nw, height: nh, label };
}

export function parseWatermarkLocateResult(parsed: Record<string, unknown>): WatermarkLocateResult {
  const hasWatermark =
    pickBoolean(parsed, ['hasWatermark', 'has_watermark', 'watermark']) === true;
  const confidenceRaw = pickNumber(parsed, ['confidence', 'score']);
  const confidence =
    confidenceRaw == null ? (hasWatermark ? 0.75 : 0.5) : clamp01(confidenceRaw);
  const reason =
    typeof parsed.reason === 'string' && parsed.reason.trim()
      ? parsed.reason.trim()
      : hasWatermark
        ? 'Vision model detected watermark/branding overlay'
        : 'No watermark detected';

  const regionsRaw = parsed.regions ?? parsed.boxes ?? parsed.areas;
  const regions: NormalizedRegion[] = [];
  if (Array.isArray(regionsRaw)) {
    for (const item of regionsRaw) {
      const region = parseRegion(item);
      if (region) regions.push(region);
    }
  }

  return { hasWatermark, confidence, regions, reason };
}

/** Common WhatsApp forward watermark corners when vision returns nothing specific. */
export function defaultCornerRegions(): NormalizedRegion[] {
  return [
    { x: 0.62, y: 0.8, width: 0.36, height: 0.18, label: 'bottom-right corner' },
    { x: 0, y: 0, width: 0.32, height: 0.14, label: 'top-left corner' },
  ];
}
