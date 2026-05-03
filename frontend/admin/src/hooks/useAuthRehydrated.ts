'use client';

/**
 * Vestigial hook from when admin auth used zustand persist + localStorage.
 * Auth state is now cookie-only and lives in memory; there's nothing to
 * "rehydrate". The hook is kept for source compatibility with call sites
 * that still gate UI on `if (!authRehydrated) return <spinner/>`. Returns
 * true synchronously after first paint.
 */
import { useEffect, useState } from 'react';

export function useAuthRehydrated(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  return ready;
}
