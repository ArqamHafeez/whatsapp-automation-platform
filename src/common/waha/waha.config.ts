/**
 * WAHA (WhatsApp HTTP API) connection settings.
 */
export function getWahaConfig(): { baseUrl: string; apiKey: string } {
  const baseUrl = (
    process.env.WAHA_API_URL?.trim() ||
    process.env.WAHA_BASE_URL?.trim() ||
    process.env.EVOLUTION_API_URL?.trim() ||
    process.env.EVOLUTION_BASE_URL?.trim() ||
    'http://127.0.0.1:8081'
  ).replace(/\/$/, '');

  const apiKey =
    process.env.WAHA_API_KEY?.trim() ||
    process.env.EVOLUTION_API_KEY?.trim() ||
    'dev-key';

  return { baseUrl, apiKey };
}

export function wahaHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Api-Key': apiKey,
  };
}
