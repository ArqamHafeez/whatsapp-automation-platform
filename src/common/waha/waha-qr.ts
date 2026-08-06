import { Logger } from '@nestjs/common';
import { getWahaConfig, wahaHeaders } from './waha.config';

const logger = new Logger('WahaQr');

export async function fetchWahaQrBuffer(
  baseUrl: string,
  apiKey: string,
  sessionName: string,
): Promise<{ buffer: Buffer; mime: string; dataUrl: string | null } | null> {
  const url = `${baseUrl}/api/${encodeURIComponent(sessionName)}/auth/qr`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        Accept: 'image/png',
      },
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.warn(`QR ${sessionName} HTTP ${res.status}: ${text.slice(0, 200)}`);
      return null;
    }

    const contentType = res.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 100) {
      logger.warn(`QR ${sessionName}: response too small (${buffer.length} bytes)`);
      return null;
    }

    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
    if (!isPng && !isJpeg) {
      logger.warn(
        `QR ${sessionName}: not an image (content-type=${contentType}, head=${buffer.subarray(0, 12).toString('hex')})`,
      );
      return null;
    }

    const mime = isPng ? 'image/png' : isJpeg ? 'image/jpeg' : contentType.split(';')[0].trim() || 'image/png';
    const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
    return { buffer, mime, dataUrl };
  } catch (err) {
    logger.warn(`QR fetch failed: ${(err as Error).message}`);
    return null;
  }
}

export async function fetchWahaQrDataUrl(sessionName: string): Promise<string | null> {
  const { baseUrl, apiKey } = getWahaConfig();
  const result = await fetchWahaQrBuffer(baseUrl, apiKey, sessionName);
  return result?.dataUrl ?? null;
}
