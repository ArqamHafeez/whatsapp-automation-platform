import sharp from 'sharp';
import { getImageEditConfig } from './image-edit.config';
import { NormalizedRegion } from './watermark-region.schema';
import { buildEditMask } from './watermark-mask';

export type CloudRemoveResult = {
  buffer: Buffer;
  mimeType: string;
  provider: string;
};

export async function removeWatermarkRegionsCloud(
  imageBuffer: Buffer,
  regions: NormalizedRegion[],
  prompt: string,
): Promise<CloudRemoveResult> {
  const { openaiApiKey, openaiEditModel } = getImageEditConfig();
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY is required for cloud image edit (IMAGE_EDIT_PROVIDER=cloud)');
  }

  const meta = await sharp(imageBuffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) {
    throw new Error('Unable to read image dimensions for cloud edit');
  }

  const pngImage = await sharp(imageBuffer).png().toBuffer();
  const mask = await buildEditMask(width, height, regions);

  const form = new FormData();
  form.append('model', openaiEditModel);
  form.append('prompt', prompt);
  form.append('image', new Blob([Uint8Array.from(pngImage)], { type: 'image/png' }), 'image.png');
  form.append('mask', new Blob([Uint8Array.from(mask)], { type: 'image/png' }), 'mask.png');

  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiApiKey}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloud image edit failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error('Cloud image edit returned no image data');
  }

  return {
    buffer: Buffer.from(b64, 'base64'),
    mimeType: 'image/png',
    provider: 'openai',
  };
}
