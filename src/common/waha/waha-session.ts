import { Logger } from '@nestjs/common';
import { getWahaConfig, wahaHeaders } from './waha.config';
import { getWahaWebhookConfig, wahaSessionConfig } from './waha-webhook';

const logger = new Logger('WahaSession');

export type WahaSessionStatus =
  | 'STOPPED'
  | 'STARTING'
  | 'SCAN_QR_CODE'
  | 'WORKING'
  | 'FAILED'
  | string;

export type WahaSessionInfo = {
  name: string;
  status: WahaSessionStatus;
  config?: Record<string, unknown>;
  me?: { id?: string; pushName?: string } | null;
};

export type WahaFetchSessionResult = {
  session: WahaSessionInfo | null;
  httpStatus: number | null;
  error: string | null;
};

export function isWahaSessionWorking(session: WahaSessionInfo | null | undefined): boolean {
  if (!session) {
    return false;
  }
  return String(session.status).toUpperCase() === 'WORKING';
}

export function mapWahaStatusToConnection(status: WahaSessionStatus): 'connected' | 'pending' | 'disconnected' {
  const s = String(status).toUpperCase();
  if (s === 'WORKING') {
    return 'connected';
  }
  if (s === 'STOPPED' || s === 'FAILED') {
    return 'disconnected';
  }
  return 'pending';
}

export async function wahaFetchSessionDetailed(sessionName: string): Promise<WahaFetchSessionResult> {
  const { baseUrl, apiKey } = getWahaConfig();
  try {
    const res = await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(sessionName)}`, {
      headers: wahaHeaders(apiKey),
      signal: AbortSignal.timeout(10_000),
    });

    if (res.status === 401) {
      return {
        session: null,
        httpStatus: 401,
        error: 'WAHA rejected the API key — set WAHA_API_KEY in backend .env to match ~/internshiptasks/waha/.env',
      };
    }

    if (res.status === 404) {
      return {
        session: null,
        httpStatus: 404,
        error: `WAHA session "${sessionName}" not found`,
      };
    }

    if (!res.ok) {
      const text = await res.text();
      return {
        session: null,
        httpStatus: res.status,
        error: `WAHA session fetch failed (${res.status}): ${text.slice(0, 200)}`,
      };
    }

    return {
      session: (await res.json()) as WahaSessionInfo,
      httpStatus: res.status,
      error: null,
    };
  } catch (err) {
    const message = (err as Error).message;
    logger.warn(`fetchSession ${sessionName}: ${message}`);
    return {
      session: null,
      httpStatus: null,
      error: `Cannot reach WAHA at ${baseUrl}: ${message}`,
    };
  }
}

export async function wahaFetchSession(sessionName: string): Promise<WahaSessionInfo | null> {
  const result = await wahaFetchSessionDetailed(sessionName);
  return result.session;
}

export async function wahaListSessions(): Promise<WahaSessionInfo[]> {
  const { baseUrl, apiKey } = getWahaConfig();
  try {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      headers: wahaHeaders(apiKey),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return [];
    }
    const body = await res.json();
    return Array.isArray(body) ? body : [];
  } catch {
    return [];
  }
}

export async function wahaEnsureSession(
  sessionName: string,
  options?: { start?: boolean; withWebhook?: boolean },
): Promise<WahaSessionInfo> {
  const existing = await wahaFetchSessionDetailed(sessionName);
  if (existing.session) {
    logger.log(`ensureSession ${sessionName}: reusing existing WAHA session (${existing.session.status})`);
    return existing.session;
  }

  if (existing.httpStatus === 404) {
    return wahaCreateSession(sessionName, options);
  }

  throw new Error(existing.error ?? `Could not resolve WAHA session "${sessionName}"`);
}

export async function wahaCreateSession(
  sessionName: string,
  options?: { start?: boolean; withWebhook?: boolean },
): Promise<WahaSessionInfo> {
  const { baseUrl, apiKey } = getWahaConfig();
  const webhook = options?.withWebhook !== false ? getWahaWebhookConfig() : null;
  const body = {
    name: sessionName,
    start: options?.start ?? true,
    config: wahaSessionConfig(webhook),
  };

  const res = await fetch(`${baseUrl}/api/sessions/`, {
    method: 'POST',
    headers: wahaHeaders(apiKey),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WAHA create session failed (${res.status}): ${text.slice(0, 400)}`);
  }

  return (await res.json()) as WahaSessionInfo;
}

export async function wahaStartSession(sessionName: string): Promise<void> {
  const { baseUrl, apiKey } = getWahaConfig();
  const res = await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(sessionName)}/start`, {
    method: 'POST',
    headers: wahaHeaders(apiKey),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WAHA start session failed (${res.status}): ${text.slice(0, 300)}`);
  }
}

export async function wahaRestartSession(sessionName: string): Promise<void> {
  const { baseUrl, apiKey } = getWahaConfig();
  const res = await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(sessionName)}/restart`, {
    method: 'POST',
    headers: wahaHeaders(apiKey),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WAHA restart session failed (${res.status}): ${text.slice(0, 300)}`);
  }
}

export async function wahaUpdateSessionWebhooks(sessionName: string): Promise<void> {
  const webhook = getWahaWebhookConfig();
  if (!webhook) {
    throw new Error('WEBHOOK_PUBLIC_URL is not set');
  }

  const existing = await wahaFetchSession(sessionName);
  if (!existing) {
    throw new Error(`Session "${sessionName}" not found on WAHA`);
  }

  const { baseUrl, apiKey } = getWahaConfig();
  const existingConfig =
    existing.config && typeof existing.config === 'object' ? { ...existing.config } : {};

  const config = {
    ...existingConfig,
    webhooks: [
      {
        url: webhook.url,
        events: webhook.events,
      },
    ],
  };

  const res = await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(sessionName)}`, {
    method: 'PUT',
    headers: wahaHeaders(apiKey),
    body: JSON.stringify({ name: sessionName, config }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WAHA webhook update failed (${res.status}): ${text.slice(0, 400)}`);
  }
}

export async function wahaDeleteSession(sessionName: string): Promise<void> {
  const { baseUrl, apiKey } = getWahaConfig();
  try {
    await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(sessionName)}`, {
      method: 'DELETE',
      headers: wahaHeaders(apiKey),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    logger.warn(`deleteSession ${sessionName}: ${(err as Error).message}`);
  }
}
