import sharp from 'sharp';
import { getImageEditConfig } from './image-edit.config';
import { NormalizedRegion } from './watermark-region.schema';
import { regionPixels } from './watermark-remove.shared';

export type LocalRemoveResult = {
  buffer: Buffer;
  mimeType: string;
  regionsTouched: string[];
};

export async function removeWatermarkRegionsLocal(
  imageBuffer: Buffer,
  regions: NormalizedRegion[],
): Promise<LocalRemoveResult> {
  const { blurSigma } = getImageEditConfig();
  const meta = await sharp(imageBuffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) {
    throw new Error('Unable to read image dimensions');
  }

  let working = imageBuffer;
  const regionsTouched: string[] = [];

  for (const region of regions) {
    const box = regionPixels(region, width, height);
    const blurred = await sharp(working)
      .extract(box)
      .blur(blurSigma)
      .toBuffer();

    working = await sharp(working)
      .composite([{ input: blurred, left: box.left, top: box.top }])
      .toBuffer();

    regionsTouched.push(region.label || `${box.left},${box.top} ${box.width}x${box.height}`);
  }

  const format = meta.format === 'png' ? 'png' : 'jpeg';
  const output =
    format === 'png'
      ? await sharp(working).png().toBuffer()
      : await sharp(working).jpeg({ quality: 90 }).toBuffer();

  return {
    buffer: output,
    mimeType: format === 'png' ? 'image/png' : 'image/jpeg',
    regionsTouched,
  };
}
