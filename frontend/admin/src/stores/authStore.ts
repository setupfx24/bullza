import { create } from 'zustand';
import { adminApi } from '@/lib/api';

interface Admin {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

interface MeResponse {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
}

interface AuthState {
  admin: Admin | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Probe /auth/me to find out whether the httpOnly cookie still grants
   * access; populates the Admin profile if so. Returns true on success. */
  refreshAdminProfile: () => Promise<boolean>;
}

/**
 * Auth state lives in memory only — the JWT itself is in the httpOnly
 * `swisdex_admin` cookie set by the server, which JS cannot read. That
 * removes the XSS-exfil class of attack the previous localStorage path
 * was open to.
 *
 * On hard reload, isAuthenticated starts false and refreshAdminProfile()
 * is called from AdminLayout to re-hydrate from the cookie.
 */
export const useAuthStore = create<AuthState>()((set) => ({
  admin: null,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    const res = await adminApi.post<{
      access_token: string;
      admin_id: string;
      role: string;
      first_name: string | null;
      last_name: string | null;
    }>('/auth/login', { email, password });

    // Cookie is set by the server response — nothing to store locally.
    const admin: Admin = {
      id: res.admin_id,
      email,
      full_name: [res.first_name, res.last_name].filter(Boolean).join(' ') || email,
      role: res.role,
    };
    set({ admin, isAuthenticated: true });
  },

  logout: async () => {
    try {
      await adminApi.post('/auth/logout');
    } catch {
      /* ignore — clear state anyway */
    }
    adminApi.clearToken();
    set({ admin: null, isAuthenticated: false });
    if (typeof window !== 'undefined') window.location.href = '/login';
  },

  refreshAdminProfile: async () => {
    try {
      const me = await adminApi.get<MeResponse>('/auth/me');
      const admin: Admin = {
        id: me.id,
        email: me.email,
        full_name: [me.first_name, me.last_name].filter(Boolean).join(' ') || me.email,
        role: me.role,
      };
      set({ admin, isAuthenticated: true });
      return true;
    } catch {
      set({ admin: null, isAuthenticated: false });
      return false;
    }
  },
}));
