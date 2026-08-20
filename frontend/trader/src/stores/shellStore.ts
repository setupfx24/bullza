import { create } from 'zustand';

interface ShellState {
  sidebarOpen: boolean;
  /** The header hamburger's slide-down navigation panel (TopNavMenu). */
  topMenuOpen: boolean;
  _hydrated: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setTopMenuOpen: (open: boolean) => void;
  toggleTopMenu: () => void;
  hydrate: () => void;
}

export const useShellStore = create<ShellState>((set) => ({
  /* Default open so desktop users see the nav immediately on first paint.
     Hydrate then closes it on screens < 1024px. */
  sidebarOpen: true,
  topMenuOpen: false,
  _hydrated: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setTopMenuOpen: (open) => set({ topMenuOpen: open }),
  toggleTopMenu: () => set((s) => ({ topMenuOpen: !s.topMenuOpen })),
  hydrate: () => set((s) => {
    if (s._hydrated) return {};
    return { sidebarOpen: window.innerWidth >= 1024, _hydrated: true };
  }),
}));

// Hydrate on client — runs once after mount
if (typeof window !== 'undefined') {
  setTimeout(() => useShellStore.getState().hydrate(), 0);
}
