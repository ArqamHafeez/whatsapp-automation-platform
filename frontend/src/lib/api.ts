/** Same-origin `/api` proxy in the browser; direct backend URL on the server. */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api`;
  }
  return (process.env.BACKEND_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
}

/** @deprecated Prefer getApiBaseUrl() so the client resolves after hydration. */
export const API_BASE_URL = getApiBaseUrl();

function formatApiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }
  const data = payload as { message?: string | string[] };
  if (Array.isArray(data.message)) {
    return data.message.join(', ');
  }
  if (typeof data.message === 'string') {
    return data.message;
  }
  return fallback;
}

export async function fetchApi<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
  let token: string | null = null;
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('token');
  }

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (err) {
    const hint =
      typeof window !== 'undefined'
        ? `Could not reach ${getApiBaseUrl()}. Keep Next on :3001, Nest on :3000, and restart Next after env changes.`
        : '';
    const base = err instanceof Error ? err.message : 'Network error';
    throw new Error(hint ? `${base}. ${hint}` : base);
  }

  if (!response.ok) {
    let errorMessage = 'An error occurred';
    try {
      const errorData = await response.json();
      errorMessage = formatApiErrorMessage(errorData, errorMessage);
    } catch {
      errorMessage = response.statusText;
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}

export async function fetchApiBlob(endpoint: string): Promise<Blob> {
  let token: string | null = null;
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('token');
  }

  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${endpoint}`, { headers });
  } catch (err) {
    const base = err instanceof Error ? err.message : 'Network error';
    throw new Error(base);
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const err = await response.json();
      detail = formatApiErrorMessage(err, detail);
    } catch {
      // ignore
    }
    throw new Error(detail || 'Failed to load resource');
  }

  const contentType = response.headers.get('content-type')?.split(';')[0].trim() || 'application/octet-stream';
  const buffer = await response.arrayBuffer();
  if (!buffer.byteLength) {
    throw new Error('Empty response body');
  }
  return new Blob([buffer], { type: contentType });
}
