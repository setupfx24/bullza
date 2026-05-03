'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useAuthRehydrated } from '@/hooks/useAuthRehydrated';
import { Loader2 } from 'lucide-react';

export default function RootPage() {
  const router = useRouter();
  const authRehydrated = useAuthRehydrated();
  const probedRef = useRef(false);

  useEffect(() => {
    if (!authRehydrated || probedRef.current) return;
    probedRef.current = true;
    // Cookie-only auth — single probe; route based on result.
    void useAuthStore.getState().refreshAdminProfile().then((ok) => {
      router.replace(ok ? '/dashboard' : '/login');
    }).catch(() => {
      router.replace('/login');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authRehydrated]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-bg-primary">
      <Loader2 size={24} className="animate-spin text-text-tertiary" />
    </div>
  );
}
