import sharp from 'sharp';
import { NormalizedRegion } from './watermark-region.schema';
import { regionPixels } from './watermark-remove.shared';

export async function buildEditMask(
  width: number,
  height: number,
  regions: NormalizedRegion[],
): Promise<Buffer> {
  let mask = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  for (const region of regions) {
    const box = regionPixels(region, width, height);
    const hole = await sharp({
      create: {
        width: box.width,
        height: box.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer();
    mask = await sharp(mask)
      .composite([{ input: hole, left: box.left, top: box.top }])
      .png()
      .toBuffer();
  }

  return mask;
}
