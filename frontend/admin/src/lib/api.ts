/**
 * Browser-reachable admin API base (no trailing slash).
 * - If NEXT_PUBLIC_ADMIN_API_URL or NEXT_PUBLIC_API_URL is set → `{origin}/api/v1/admin`.
 * - Otherwise same-origin `/admin-api` (proxied by app/admin-api route → admin service).
 */
export function getAdminApiBase(): string {
  const raw = (process.env.NEXT_PUBLIC_ADMIN_API_URL || process.env.NEXT_PUBLIC_API_URL || '').trim();
  if (raw) {
    const u = raw.replace(/\/$/, '');
    if (u.includes('/api/v1/admin')) return u;
    return `${u}/api/v1/admin`;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/admin-api`;
  }
  return `${(process.env.ADMIN_API_PROXY_TARGET || 'http://127.0.0.1:8001').replace(/\/$/, '')}/api/v1/admin`;
}

/** FastAPI returns `detail` as string, object, or validation error array — never pass raw objects to `new Error()`. */
export function formatApiErrorDetail(detail: unknown): string {
  if (detail == null) return '';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item: unknown) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'msg' in item) {
          const o = item as { msg?: string; loc?: unknown[]; type?: string };
          const loc = Array.isArray(o.loc) ? o.loc.filter((x) => x !== 'body').join('.') : '';
          return loc ? `${loc}: ${o.msg || 'invalid'}` : (o.msg || JSON.stringify(item));
        }
        try {
          return JSON.stringify(item);
        } catch {
          return String(item);
        }
      })
      .join('; ');
  }
  if (typeof detail === 'object' && detail !== null && 'message' in detail && typeof (detail as { message: unknown }).message === 'string') {
    return (detail as { message: string }).message;
  }
  try {
    return JSON.stringify(detail);
  } catch {
    return 'Request failed';
  }
}

// Auth token now lives in an httpOnly cookie (`admin_access`) set by
// /admin/auth/login. JS cannot read or write it — that's the whole point;
// it removes the XSS-exfil exposure that the localStorage path had. The
// keys below are kept only for one-shot cleanup of legacy storage on load.
export const ADMIN_TOKEN_KEY = 'admin_token';
export const ADMIN_AUTH_KEY = 'admin-auth';

class AdminApi {
  /** No-op kept for backwards source compatibility. The cookie is the
   * source of truth now; calling this used to write sessionStorage. */
  setToken(_t: string) {
    /* httpOnly cookie is set by the server; nothing to do client-side */
  }

  getToken(): string | null {
    return null;
  }

  clearToken() {
    if (typeof window !== 'undefined') {
      // Wipe any lingering legacy storage from previous versions.
      try {
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        sessionStorage.removeItem(ADMIN_AUTH_KEY);
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        localStorage.removeItem(ADMIN_AUTH_KEY);
      } catch {
        /* ignore */
      }
    }
  }

  private async req<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>,
  ): Promise<T> {
    const base = getAdminApiBase();
    const p = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${base}${p}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include', // send/receive the admin_access cookie
    });

    if (res.status === 401) {
      this.clearToken();
      // CRITICAL: don't redirect when:
      //  (a) the call is a session probe (/auth/me) — the login page calls
      //      this on mount intentionally to skip the form for already-logged-
      //      in users; a 401 here is the expected case and MUST NOT cause a
      //      page reload, or we get an infinite reload loop;
      //  (b) we're already on /login.
      // Without this guard, every /me 401 hard-reloaded /login, which
      // re-mounted, called /me again, 401 again, loop. ~2 reloads/sec.
      if (typeof window !== 'undefined') {
        const onLoginPage = window.location.pathname.startsWith('/login');
        const isAuthProbe = path.includes('/auth/me');
        if (!onLoginPage && !isAuthProbe) {
          window.location.href = '/login';
        }
      }
      throw new Error('Unauthorized');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      const msg = formatApiErrorDetail(err.detail) || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return res.json();
  }

  get<T>(path: string, params?: Record<string, string>) {
    return this.req<T>('GET', path, undefined, params);
  }
  post<T>(path: string, body?: unknown) {
    return this.req<T>('POST', path, body);
  }
  put<T>(path: string, body?: unknown) {
    return this.req<T>('PUT', path, body);
  }
  patch<T>(path: string, body?: unknown) {
    return this.req<T>('PATCH', path, body);
  }
  delete<T>(path: string) {
    return this.req<T>('DELETE', path);
  }

  /** Multipart upload (do not set Content-Type — browser sets boundary). */
  async postForm<T>(path: string, formData: FormData): Promise<T> {
    const base = getAdminApiBase();
    const p = path.startsWith('/') ? path : `/${path}`;
    const url = `${base}${p}`;

    const res = await fetch(url, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (res.status === 401) {
      this.clearToken();
      if (typeof window !== 'undefined') {
        const onLoginPage = window.location.pathname.startsWith('/login');
        if (!onLoginPage) {
          window.location.href = '/login';
        }
      }
      throw new Error('Unauthorized');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      const msg = formatApiErrorDetail(err.detail) || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return res.json();
  }
}

export const adminApi = new AdminApi();
