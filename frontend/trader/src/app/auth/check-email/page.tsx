'use client';

/**
 * /auth/check-email — landing page after a successful sign-up.
 *
 * Tells the user we've sent a verify-link to their inbox and offers a
 * "Resend email" button (rate-limited on the backend) and a "Sign in"
 * link. The verify link in the email points at /auth/verify-email which
 * flips the flag and bounces them to /auth/login?verified=1.
 */
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api/client';
import '../auth.css';

function CheckEmailContent() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get('email') || '';
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    if (!email) {
      toast.error('No email on file. Please sign in to resend.');
      return;
    }
    setResending(true);
    try {
      await api.post<{ message: string }>('/auth/resend-verification', { email });
      toast.success('Verification email sent. Check your inbox.');
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(err?.message || 'Could not resend right now. Try again in a few minutes.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card-wrapper">
        <div className="auth-card" style={{ minHeight: 'auto' }}>
          <div className="auth-right" style={{ width: '100%' }}>
            <div style={{ width: '100%', maxWidth: 420, textAlign: 'center', padding: '40px 20px' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'rgba(85,166,48,0.12)', border: '1px solid rgba(85,166,48,0.3)',
                margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Mail size={32} style={{ color: '#55a630' }} />
              </div>
              <h2 className="auth-form__title">Check your inbox</h2>
              <p className="auth-form__subtitle" style={{ marginBottom: 16 }}>
                We&apos;ve sent a verification link to{' '}
                <strong style={{ color: 'var(--text-primary, #fff)' }}>{email || 'your email'}</strong>.
                Click it to activate your account.
              </p>
              <p className="auth-form__subtitle" style={{ fontSize: 12, marginBottom: 24, opacity: 0.7 }}>
                The link is valid for 24 hours. Didn&apos;t see it? Check your spam folder.
              </p>
              <button
                type="button"
                className="auth-btn auth-btn--outline"
                onClick={handleResend}
                disabled={resending}
                style={{ marginBottom: 12 }}
              >
                {resending ? <Loader2 size={18} className="auth-spinner" /> : 'Resend verification email'}
              </button>
              <button
                type="button"
                className="auth-btn"
                onClick={() => router.push('/auth/login')}
              >
                Go to sign in
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense fallback={null}>
      <CheckEmailContent />
    </Suspense>
  );
}
