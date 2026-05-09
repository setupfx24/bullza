'use client';

/**
 * /auth/verify-email — landing page the email-verify link points at.
 *
 * Reads ?token= from the URL, calls GET /auth/verify-email?token=…,
 * shows success / error, and offers a button to continue to /auth/login.
 *
 * Flow:
 *   1. User signs up → backend sends email with link to this page.
 *   2. User clicks link → this page POSTs the token to /auth/verify-email.
 *   3. On success, redirect to /auth/login?verified=1 (the login page
 *      detects the flag and shows a green "Email verified — sign in" banner).
 */
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import api from '@/lib/api/client';
import '../auth.css';

function VerifyEmailContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<'loading' | 'ok' | 'fail'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setState('fail');
      setMessage('Missing verification token. Please open the link from the email we sent you.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await api.get<{ message: string; verified: boolean }>(
          `/auth/verify-email?token=${encodeURIComponent(token)}`,
        );
        if (cancelled) return;
        setState('ok');
        setMessage('Email verified. Redirecting you to sign in…');
        setTimeout(() => router.push('/auth/login?verified=1'), 1200);
      } catch (e: unknown) {
        if (cancelled) return;
        const err = e as { message?: string };
        setState('fail');
        setMessage(err?.message || 'Verification link is invalid or expired.');
      }
    })();
    return () => { cancelled = true; };
  }, [token, router]);

  return (
    <div className="auth-wrapper">
      <div className="auth-card-wrapper">
        <div className="auth-card" style={{ minHeight: 'auto' }}>
          <div className="auth-right" style={{ width: '100%' }}>
            <div style={{ width: '100%', maxWidth: 380, textAlign: 'center', padding: '40px 20px' }}>
              <img
                src="/images/swisdex-logo.png"
                alt="SwisDex"
                style={{ width: 64, height: 64, objectFit: 'contain', margin: '0 auto 24px' }}
              />
              {state === 'loading' && (
                <>
                  <Loader2 size={36} className="auth-spinner" style={{ margin: '0 auto 16px', color: '#55a630' }} />
                  <h2 className="auth-form__title">Verifying…</h2>
                  <p className="auth-form__subtitle">Hold on while we confirm your email.</p>
                </>
              )}
              {state === 'ok' && (
                <>
                  <CheckCircle2 size={48} style={{ color: '#55a630', margin: '0 auto 16px', display: 'block' }} />
                  <h2 className="auth-form__title">Email verified</h2>
                  <p className="auth-form__subtitle">{message}</p>
                </>
              )}
              {state === 'fail' && (
                <>
                  <XCircle size={48} style={{ color: '#ef4444', margin: '0 auto 16px', display: 'block' }} />
                  <h2 className="auth-form__title">Verification failed</h2>
                  <p className="auth-form__subtitle" style={{ marginBottom: 24 }}>{message}</p>
                  <button
                    type="button"
                    className="auth-btn"
                    onClick={() => router.push('/auth/login')}
                  >
                    Go to sign in
                  </button>
                  <p className="auth-form__subtitle" style={{ marginTop: 16, fontSize: 12 }}>
                    Need a new link? Sign in and we&apos;ll show a resend button.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
