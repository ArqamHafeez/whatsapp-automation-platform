import { NextRequest, NextResponse } from 'next/server';
import { resolveBackendUrl } from '@/lib/resolve-backend-url';

export const runtime = 'nodejs';

type RouteCtx = { params: Promise<{ path: string[] }> };

async function proxyRequest(req: NextRequest, ctx: RouteCtx): Promise<NextResponse> {
  const { path: segments } = await ctx.params;
  if (!segments?.length) {
    return NextResponse.json({ message: 'Missing API path' }, { status: 404 });
  }

  const backend = resolveBackendUrl();
  const target = `${backend}/${segments.join('/')}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === 'host' || lower === 'connection') {
      return;
    }
    headers.set(key, value);
  });

  let body: ArrayBuffer | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await req.arrayBuffer();
  }

  const pathKey = segments.join('/');
  const proxyTimeoutMs =
    pathKey.includes('qr-data') || pathKey.includes('qr-image')
      ? 35_000
      : pathKey.includes('chats/sync')
        ? 120_000
        : 15_000;

  const init: RequestInit & { duplex?: 'half' } = {
    method: req.method,
    headers,
    body: body?.byteLength ? body : undefined,
    signal: AbortSignal.timeout(proxyTimeoutMs),
  };
  if (init.body) {
    init.duplex = 'half';
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Backend unreachable';
    return NextResponse.json(
      {
        message: `${message}. Start Nest on port 3000 or set BACKEND_URL in frontend/.env.local (WSL: use Windows host IP, e.g. from /etc/resolv.conf nameserver). Tried ${backend}.`,
      },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete('transfer-encoding');

  const buffer = await upstream.arrayBuffer();
  responseHeaders.set('content-length', String(buffer.byteLength));

  if (pathKey.includes('qr-image') && buffer.byteLength >= 8) {
    const bytes = new Uint8Array(buffer);
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    if (isPng) {
      responseHeaders.set('content-type', 'image/png');
    } else if (isJpeg) {
      responseHeaders.set('content-type', 'image/jpeg');
    }
  }

  return new NextResponse(buffer, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const OPTIONS = proxyRequest;
