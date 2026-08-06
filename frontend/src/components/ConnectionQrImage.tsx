'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchApi, getApiBaseUrl } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export function ConnectionQrImage({
  connectionId,
  enabled,
  refreshToken,
  onAlreadyLinked,
}: {
  connectionId: string;
  enabled: boolean;
  refreshToken: number;
  onAlreadyLinked?: () => void;
}) {
  const { token } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !token) {
      setStatus('idle');
      setErrorMessage(null);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setErrorMessage(null);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 25_000);

    const timer = window.setTimeout(() => {
      fetch(`${getApiBaseUrl()}/connections/${connectionId}/qr-data?t=${refreshToken}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            let detail = response.statusText;
            try {
              const err = await response.json();
              detail =
                typeof err.message === 'string'
                  ? err.message
                  : Array.isArray(err.message)
                    ? err.message.join(', ')
                    : detail;
            } catch {
              // ignore
            }
            throw new Error(detail || 'Could not load QR');
          }
          return response.json() as Promise<{ dataUrl: string }>;
        })
        .then((payload) => {
          if (cancelled) return;
          if (!payload?.dataUrl?.startsWith('data:image/')) {
            throw new Error('Invalid QR payload from server');
          }

          const image = new window.Image();
          image.onload = () => {
            if (cancelled) return;
            const canvas = canvasRef.current;
            if (!canvas) {
              setStatus('error');
              setErrorMessage('Could not initialize QR canvas.');
              return;
            }
            const w = image.naturalWidth || 280;
            const h = image.naturalHeight || 280;
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              setStatus('error');
              setErrorMessage('Could not draw QR code.');
              return;
            }
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(image, 0, 0, w, h);
            setStatus('ready');
          };
          image.onerror = () => {
            if (!cancelled) {
              setStatus('error');
              setErrorMessage('QR image failed to decode.');
            }
          };
          image.src = payload.dataUrl;
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            const message =
              err instanceof Error
                ? err.name === 'AbortError'
                  ? 'QR request timed out — click Check status / QR to retry.'
                  : err.message
                : 'Could not load QR';
            if (/already linked/i.test(message)) {
              onAlreadyLinked?.();
              setStatus('idle');
              setErrorMessage(null);
              return;
            }
            setStatus('error');
            setErrorMessage(message);
          }
        })
        .finally(() => {
          window.clearTimeout(timeout);
        });
    }, refreshToken > 0 ? 200 : 0);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
      window.clearTimeout(timeout);
    };
    // onAlreadyLinked is intentionally omitted — parent often passes an inline fn that changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, enabled, refreshToken, token]);

  if (!enabled) {
    return null;
  }

  if (!token) {
    return (
      <p style={{ color: '#64748b', fontSize: '0.875rem', padding: '1rem 0' }}>Sign in to load QR.</p>
    );
  }

  return (
    <div style={{ textAlign: 'center' }}>
      {(status === 'loading' || status === 'idle') && (
        <p style={{ color: '#334155', fontSize: '0.875rem', padding: '1.5rem 0' }}>Loading QR…</p>
      )}
      {status === 'error' && (
        <p style={{ color: '#b91c1c', fontSize: '0.875rem', padding: '1rem 0' }}>
          {errorMessage || 'Could not load QR image.'}
        </p>
      )}
      <canvas
        ref={canvasRef}
        aria-label="WhatsApp QR Code"
        style={{
          width: '280px',
          maxWidth: '100%',
          height: 'auto',
          display: status === 'ready' ? 'block' : 'none',
          margin: '0 auto',
          border: '1px solid #e2e8f0',
          borderRadius: '4px',
          background: '#fff',
        }}
      />
    </div>
  );
}
