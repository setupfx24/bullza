import { NextResponse, type NextRequest } from 'next/server';

/**
 * Server-side auth gate for the admin panel.
 *
 * Route protection used to be entirely client-side (AdminLayout probes
 * /auth/me after hydration), which briefly renders app chrome to
 * unauthenticated visitors and leaves protection to JS. This middleware
 * checks for the presence of the httpOnly admin session cookie on every
 * top-level navigation and bounces cookieless requests to /login before
 * anything renders.
 *
 * Presence-only check by design: the edge runtime must not hold the JWT
 * secret, so signature/expiry verification stays with the backend — a
 * stale cookie still 401s on the first API call and AdminLayout redirects.
 */

// Must match ADMIN_COOKIE_NAME in backend/services/admin/dependencies.py.
const ADMIN_COOKIE = process.env.NEXT_PUBLIC_ADMIN_COOKIE_NAME || 'admin_access';

const PUBLIC_PREFIXES = ['/login', '/admin-api', '/_next', '/images', '/fonts'];
// App Router serves the tab icon from src/app/icon.png at /icon.png (and
// /apple-icon.png), NOT /favicon.ico — so gating those behind auth made the
// browser 307 to /login when fetching the favicon and silently keep whatever
// icon it had cached. /logo.png is the auth page's background wordmark and is
// needed before anyone is logged in.
const PUBLIC_EXACT = new Set<string>([
  '/favicon.ico', '/robots.txt',
  '/icon.png', '/apple-icon.png', '/logo.png',
]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  // Only gate real top-level navigations; sub-resource fetches (RSC data,
  // prefetches) must resolve on the current origin.
  const mode = req.headers.get('sec-fetch-mode');
  if (mode && mode !== 'navigate') return NextResponse.next();

  if (!req.cookies.get(ADMIN_COOKIE)?.value) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
