export type ImageEditProviderName = 'local' | 'cloud';

export function getImageEditConfig(): {
  provider: ImageEditProviderName;
  maxBytes: number;
  cornerFallback: boolean;
  cloudApi: 'openai';
  openaiApiKey: string;
  openaiEditModel: string;
  blurSigma: number;
} {
  const providerRaw = (process.env.IMAGE_EDIT_PROVIDER?.trim() || 'local').toLowerCase();
  const provider: ImageEditProviderName = providerRaw === 'cloud' ? 'cloud' : 'local';

  return {
    provider,
    maxBytes: Number(process.env.IMAGE_EDIT_MAX_BYTES || 5 * 1024 * 1024),
    cornerFallback: process.env.IMAGE_EDIT_CORNER_FALLBACK?.trim() !== 'false',
    cloudApi: 'openai',
    openaiApiKey: process.env.OPENAI_API_KEY?.trim() || '',
    openaiEditModel: process.env.IMAGE_EDIT_CLOUD_MODEL?.trim() || 'dall-e-2',
    blurSigma: Number(process.env.IMAGE_EDIT_BLUR_SIGMA || 18),
  };
}
