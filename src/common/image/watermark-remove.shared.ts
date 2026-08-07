import { NormalizedRegion } from './watermark-region.schema';

export function regionPixels(
  region: NormalizedRegion,
  width: number,
  height: number,
): { left: number; top: number; width: number; height: number } {
  const left = Math.min(width - 1, Math.max(0, Math.floor(region.x * width)));
  const top = Math.min(height - 1, Math.max(0, Math.floor(region.y * height)));
  const w = Math.max(1, Math.min(width - left, Math.ceil(region.width * width)));
  const h = Math.max(1, Math.min(height - top, Math.ceil(region.height * height)));
  return { left, top, width: w, height: h };
}

export function parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/i);
  if (!match) {
    throw new Error('Image must be a base64 data URL');
  }
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

export function toDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}
