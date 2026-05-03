import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Proxies /admin-api/* → admin-api service at /api/v1/admin/*.
 * Set ADMIN_API_PROXY_TARGET (e.g. http://admin-api:8001 in Docker, http://127.0.0.1:8001 locally).
 *
 * Critical: this proxy MUST forward `Cookie` (request) and `Set-Cookie`
 * (response) headers. The admin app's auth uses an httpOnly cookie
 * (`swisdex_admin`) — without bidirectional cookie forwarding, login
 * succeeds at admin-api but the cookie never reaches the browser, then
 * /auth/me returns 401, and the SPA boots into a redirect loop.
 *
 * Headers we deliberately do NOT forward outbound:
 *   - host           (would mismatch admin-api's expected vhost)
 *   - connection     (per-hop)
 *   - content-length (browser body may differ from arrayBuffer length)
 */
function adminApiOrigin(): string {
  const raw =
    process.env.ADMIN_API_PROXY_TARGET ||
    process.env.ADMIN_API_INTERNAL_URL ||
    'http://127.0.0.1:8001';
  return String(raw).replace(/\/$/, '');
}

const HOP_BY_HOP = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'content-length',
]);

async function segmentsFromParams(params: Promise<{ path?: string[] }>): Promise<string[]> {
  const p = await params;
  return p.path ?? [];
}

async function proxy(req: NextRequest, segments: string[]): Promise<NextResponse> {
  const sub = segments.length ? segments.join('/') : '';
  const path = sub ? `api/v1/admin/${sub}` : 'api/v1/admin';
  const targetUrl = `${adminApiOrigin()}/${path}${req.nextUrl.search}`;

  // Forward all browser-supplied headers EXCEPT hop-by-hop ones.
  // This is what makes the cookie-based auth work end-to-end.
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  // Tell admin-api we proxied an HTTPS request so its Secure-cookie
  // detection works regardless of the docker-internal http hop.
  headers.set('x-forwarded-proto', 'https');
  headers.set('x-forwarded-host', req.headers.get('host') || '');

  const method = req.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);
  let body: ArrayBuffer | undefined;
  if (hasBody) {
    try {
      body = await req.arrayBuffer();
    } catch {
      body = undefined;
    }
  }

  const ctrl =
    typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
      ? AbortSignal.timeout(120_000)
      : undefined;

  let res: Response;
  try {
    res = await fetch(targetUrl, {
      method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      signal: ctrl,
      // Don't follow redirects automatically — pass the 30x through
      // so the browser sees the same URL the admin-api intended.
      redirect: 'manual',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'fetch failed';
    console.error('[admin-api proxy]', targetUrl, msg);
    return NextResponse.json(
      {
        detail:
          'Cannot reach admin API. Ensure admin-api is running and ADMIN_API_PROXY_TARGET is correct. ' +
          `Target: ${adminApiOrigin()}`,
      },
      { status: 502 },
    );
  }

  let buf: ArrayBuffer;
  try {
    buf = await res.arrayBuffer();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'read failed';
    console.error('[admin-api proxy] response body', targetUrl, msg);
    return NextResponse.json({ detail: 'Failed to read admin API response' }, { status: 502 });
  }

  // Forward all backend response headers EXCEPT hop-by-hop ones —
  // critical for Set-Cookie (which is how the auth cookie reaches the
  // browser after /auth/login).
  const out = new Headers();
  res.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    // Header names are case-insensitive but Set-Cookie is special: the
    // Headers API stores multiple values comma-joined, but Next's
    // Response constructor handles it correctly when we use append().
    if (key.toLowerCase() === 'set-cookie') {
      out.append('set-cookie', value);
    } else {
      out.set(key, value);
    }
  });
  // res.headers.getSetCookie() is the spec-correct way to read multiple
  // Set-Cookie headers. Available in Node 18.14+ / Next 15.
  if (typeof (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === 'function') {
    out.delete('set-cookie');
    for (const c of (res.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()) {
      out.append('set-cookie', c);
    }
  }

  return new NextResponse(buf, {
    status: res.status,
    statusText: res.statusText,
    headers: out,
  });
}

type RouteCtx = { params: Promise<{ path?: string[] }> };

async function safeProxy(req: NextRequest, ctx: RouteCtx): Promise<NextResponse> {
  try {
    const segments = await segmentsFromParams(ctx.params);
    return await proxy(req, segments);
  } catch (e) {
    console.error('[admin-api proxy] unhandled', e);
    return NextResponse.json({ detail: 'Admin API proxy error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  return safeProxy(req, ctx);
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  return safeProxy(req, ctx);
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  return safeProxy(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  return safeProxy(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  return safeProxy(req, ctx);
}
