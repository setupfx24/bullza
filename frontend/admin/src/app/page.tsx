'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useAuthRehydrated } from '@/hooks/useAuthRehydrated';
import { Loader2 } from 'lucide-react';

export default function RootPage() {
  const router = useRouter();
  const refreshAdminProfile = useAuthStore((s) => s.refreshAdminProfile);
  const authRehydrated = useAuthRehydrated();

  useEffect(() => {
    if (!authRehydrated) return;
    // Cookie-only auth — ask the server whether we have a valid session.
    void refreshAdminProfile().then((ok) => {
      router.replace(ok ? '/dashboard' : '/login');
    });
  }, [authRehydrated, refreshAdminProfile, router]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-bg-primary">
      <Loader2 size={24} className="animate-spin text-text-tertiary" />
    </div>
  );
}
