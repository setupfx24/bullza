'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
// import ConnectWalletButton from '@/components/auth/ConnectWalletButton'; // Re-enable when wallet login goes live
import PhoneInput from '@/components/forms/PhoneInput';
import TurnstileWidget from '@/components/forms/TurnstileWidget';
import { scorePassword, PASSWORD_REQUIREMENTS } from '@/lib/passwordPolicy';
import '../auth.css';

/* ── animation helpers ── */
const fadeUp = (delay: number) => ({
  initial: { y: 16, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  transition: { delay, duration: 0.45, ease: 'easeOut' as const },
});

const formVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

/* ── step config ── */
const STEPS = [
  { number: 1, label: 'Sign in to your account' },
  { number: 2, label: 'Sign up your account' },
];

const LEFT_CONFIG: Record<number, { title: string; subtitle: string }> = {
  1: { title: 'Welcome Back', subtitle: 'Sign in to continue where you left off.' },
  2: { title: 'Get Started with Us', subtitle: 'Complete these easy steps to register your account.' },
};

/* ── Input Field ── */
function AuthInput({
  label, type = 'text', placeholder, value, onChange, error, helper, rightIcon, onIconClick,
}: {
  label: string; type?: string; placeholder?: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string; helper?: string; rightIcon?: React.ReactNode; onIconClick?: () => void;
}) {
  return (
    <div className="auth-field">
      <label className="auth-field__label">{label}</label>
      <div className="auth-field__wrap">
        <input
          className={`auth-field__input${rightIcon ? ' auth-field__input--has-icon' : ''}${error ? ' auth-field__input--error' : ''}`}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
        />
        {rightIcon && (
          <button type="button" className="auth-field__icon" onClick={onIconClick}>{rightIcon}</button>
        )}
      </div>
      {error && <span className="auth-field__error">{error}</span>}
      {!error && helper && <span className="auth-field__helper">{helper}</span>}
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register, demoLogin, isLoading } = useAuthStore();
  const [demoLoading, setDemoLoading] = useState(false);

  const handleDemo = async () => {
    setDemoLoading(true);
    try {
      await demoLogin();
      toast.success('Welcome — demo account');
      router.push('/accounts');
    } catch (err: any) {
      toast.error(err?.message || 'Demo sign-in failed');
    } finally {
      setDemoLoading(false);
    }
  };

  const [form, setForm] = useState({
    email: '', password: '', confirmPassword: '',
    first_name: '', last_name: '', phone: '', referral_code: '',
  });
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  // Cloudflare Turnstile token, set when the widget solves the challenge.
  // Backend rejects the register call with HTTP 400 if SECRET is
  // configured AND this is empty/invalid; the widget short-circuits and
  // emits '' when no NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY is set
  // (dev mode) so the form keeps working without keys.
  const [turnstileToken, setTurnstileToken] = useState('');
  // Bumped on captcha-related submit failures so the TurnstileWidget
  // remounts and Cloudflare issues a fresh challenge. Combined with the
  // widget's own expired/error auto-reset it covers both the
  // user-took-too-long and the click-immediately-after-expiry timing
  // windows without forcing a page reload.
  const [turnstileNonce, setTurnstileNonce] = useState(0);
  // Terms & Conditions / Privacy / Risk Disclaimer agreement. Required
  // before the Sign Up button can submit — gives the user an explicit
  // opt-in for the legal pages they're agreeing to. Unchecked by default
  // so consent is affirmative, not pre-ticked.
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Company / 'House' IB referral code, fetched once on mount. Powers the
  // 'Apply' shortcut on the referral input so an unreferred signup can
  // still claim the welcome bonus via the broker's own IB code.
  const [companyIbCode, setCompanyIbCode] = useState<string | null>(null);

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) setForm((prev) => ({ ...prev, referral_code: ref }));
  }, [searchParams]);

  useEffect(() => {
    // Same-origin call to the public endpoint — no auth header needed.
    // Silent failure: a missing/disabled company IB just leaves the
    // Apply button as a no-op, the input still works for typed codes.
    (async () => {
      try {
        const res = await fetch('/api/v1/auth/company-ib-code', { credentials: 'omit' });
        if (!res.ok) return;
        const data = await res.json();
        if (data && typeof data.referral_code === 'string') {
          setCompanyIbCode(data.referral_code);
        }
      } catch { /* offline / blocked — fall through */ }
    })();
  }, []);

  const applyCompanyIb = () => {
    if (!companyIbCode) {
      toast.error('No house referral code is configured. Ask support for a code.');
      return;
    }
    setForm((prev) => ({ ...prev, referral_code: companyIbCode }));
    toast.success(`Applied ${companyIbCode} — claim your 100% first-deposit bonus.`);
  };

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (!form.first_name.trim()) e.first_name = 'First name is required.';
    if (!form.last_name.trim()) e.last_name = 'Last name is required.';
    if (!form.email.includes('@') || !form.email.includes('.')) e.email = 'Please enter a valid email address.';
    if (!form.phone.trim()) {
      e.phone = 'Phone number is required.';
    } else if (!/^\+?[0-9 \-()]{6,20}$/.test(form.phone.trim())) {
      e.phone = 'Please enter a valid phone number.';
    }
    // Password is validated against the shared policy (passwordPolicy.ts) —
    // length + character classes + not-in-common-list + not-like-email.
    // The `disallow` list seeds substring checks so users can't reuse their
    // email local-part or first name as the password.
    const pwCheck = scorePassword(form.password, [
      form.email.split('@')[0] || '',
      form.first_name,
      form.last_name,
    ]);
    if (!pwCheck.acceptable) {
      e.password = pwCheck.issues[0] || 'Password is too weak — pick a stronger one.';
    }
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match.';
    if (!agreedToTerms) e.terms = 'You must agree to the Terms & Conditions and Privacy Policy.';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    try {
      await register({
        email: form.email,
        password: form.password,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone.trim(),
        referral_code: form.referral_code || undefined,
        // Forwarded to Cloudflare siteverify on the backend. Empty
        // string is fine when no site key is configured — server-side
        // verifier short-circuits the same way (dev parity).
        cf_turnstile_token: turnstileToken || undefined,
      });
      // Account created. The backend does NOT issue session cookies here
      // — the user has to click the verify link in their inbox, which is
      // the only path that grants a session. Bounce to /auth/check-email
      // so the user knows to check their inbox.
      toast.success('Account created — check your email to verify and sign in.');
      router.push(`/auth/check-email?email=${encodeURIComponent(form.email)}`);
    } catch (err: any) {
      const msg = err?.message || 'Registration failed';
      toast.error(msg);
      // If the rejection mentions CAPTCHA, force a fresh widget so
      // the user can re-submit without reloading the entire form.
      if (/captcha/i.test(msg)) {
        setTurnstileToken('');
        setTurnstileNonce((n) => n + 1);
      }
    } finally {
      setLoading(false);
    }
  };

  /* password strength — uses the shared policy module so the meter agrees
     with the submit-time validation and with the server-side check.   */
  const pwCheck = scorePassword(form.password, [
    form.email.split('@')[0] || '',
    form.first_name,
    form.last_name,
  ]);
  const strength = pwCheck.score;

  /* ── Step change ── */
  const handleStepClick = (step: number) => {
    if (step === 1) {
      router.push('/auth/login');
      return;
    }
  };

  return (
    <MotionConfig reducedMotion="always">
    <div className="auth-wrapper">
      <div className="auth-card-wrapper">
        <div className="auth-card">
          {/* ── LEFT PANEL ── */}
          <motion.div
            className="auth-left"
            initial={{ x: -60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            <motion.div
              className="auth-left__bg"
              animate={{ scale: [1, 1.18, 1], y: [0, -20, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="auth-left__mandala" aria-hidden="true" />
            <div className="auth-left__content">
              <motion.h1 className="auth-left__title" {...fadeUp(0.3)}>
                {LEFT_CONFIG[2].title}
              </motion.h1>
              <motion.p className="auth-left__subtitle" {...fadeUp(0.4)}>
                {LEFT_CONFIG[2].subtitle}
              </motion.p>
              <div className="auth-left__steps">
                {STEPS.map((s, i) => (
                  <motion.div key={s.number} {...fadeUp(0.45 + i * 0.08)}>
                    <div
                      className={`auth-step ${s.number === 2 ? 'auth-step--active' : 'auth-step--inactive'}`}
                      onClick={() => handleStepClick(s.number)}
                    >
                      <span className="auth-step__num">{s.number}</span>
                      <span className="auth-step__label">{s.label}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ── RIGHT PANEL ── */}
          <div className="auth-right">
            <AnimatePresence mode="wait">
              <motion.div
                key="signup"
                variants={formVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.28, ease: 'easeInOut' }}
                style={{ width: '100%', maxWidth: 380 }}
              >
                <form className="auth-form" onSubmit={handleSubmit} noValidate>
                  <motion.div {...fadeUp(0.25)} className="flex justify-center mb-1">
                    <img
                      src="/images/swisdex_png5.png"
                      alt="SwisDex"
                      className="w-12 h-12 object-contain hidden dark:block"
                    />
                    <img
                      src="/images/swisdex_png.png"
                      alt="SwisDex"
                      className="w-12 h-12 object-contain dark:hidden"
                    />
                  </motion.div>
                  <motion.div {...fadeUp(0.3)}>
                    <h2 className="auth-form__title">Sign Up Account</h2>
                    <p className="auth-form__subtitle">Enter your personal data to create your account.</p>
                  </motion.div>

                  <motion.div className="auth-name-row" {...fadeUp(0.37)}>
                    <AuthInput
                      label="First Name"
                      placeholder="eg. John"
                      value={form.first_name}
                      onChange={(e) => update('first_name', e.target.value)}
                      error={errors.first_name}
                    />
                    <AuthInput
                      label="Last Name"
                      placeholder="eg. Francisco"
                      value={form.last_name}
                      onChange={(e) => update('last_name', e.target.value)}
                      error={errors.last_name}
                    />
                  </motion.div>

                  <motion.div {...fadeUp(0.44)}>
                    <AuthInput
                      label="Email"
                      type="email"
                      placeholder=""
                      value={form.email}
                      onChange={(e) => update('email', e.target.value)}
                      error={errors.email}
                    />
                  </motion.div>

                  <motion.div {...fadeUp(0.5)}>
                    <div className="auth-field">
                      <label className="auth-field__label">Phone</label>
                      <PhoneInput
                        value={form.phone}
                        onChange={(v) => update('phone', v)}
                        defaultCountry="IN"
                        placeholder=""
                        hasError={!!errors.phone}
                      />
                      {errors.phone && (
                        <span className="auth-field__error">{errors.phone}</span>
                      )}
                    </div>
                  </motion.div>

                  <motion.div {...fadeUp(0.56)}>
                    {/*
                     * Referral input + Apply shortcut. Apply pulls the
                     * company / house IB code so an unreferred user can
                     * still claim the welcome bonus. If they arrived via
                     * ?ref=<friend-code>, that's already pre-filled by
                     * the useEffect above and Apply is unnecessary.
                     */}
                    <div className="auth-field">
                      <label className="auth-field__label">
                        Referral Code (optional)
                      </label>
                      <div className="auth-field__wrap" style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          className="auth-field__input"
                          type="text"
                          placeholder="Enter code"
                          value={form.referral_code}
                          onChange={(e) => update('referral_code', e.target.value)}
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          onClick={applyCompanyIb}
                          disabled={!companyIbCode && !form.referral_code}
                          className="auth-field__icon"
                          style={{
                            position: 'static',
                            transform: 'none',
                            padding: '0 0.9rem',
                            height: 'auto',
                            background: 'rgba(85,166,48,0.18)',
                            color: '#55a630',
                            border: '1px solid rgba(85,166,48,0.45)',
                            borderRadius: '8px',
                            fontWeight: 600,
                            fontSize: '0.78rem',
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            cursor: companyIbCode ? 'pointer' : 'not-allowed',
                            opacity: companyIbCode ? 1 : 0.4,
                          }}
                          title={
                            companyIbCode
                              ? 'Apply the platform welcome code to claim a 100% bonus on your first deposit'
                              : 'No house code configured'
                          }
                        >
                          Apply
                        </button>
                      </div>
                      <span className="auth-field__helper">
                        Apply to get <strong style={{ color: '#55a630' }}>100% bonus on your first deposit</strong>.
                        Already from a friend&apos;s link? Their code is filled in for you.
                      </span>
                    </div>
                  </motion.div>

                  <motion.div {...fadeUp(0.62)}>
                    <AuthInput
                      label="Password"
                      type={showPass ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={form.password}
                      onChange={(e) => update('password', e.target.value)}
                      error={errors.password}
                      helper="Use 8+ characters with a mix of upper, lower, number, and symbol."
                      rightIcon={showPass ? <Eye size={18} /> : <EyeOff size={18} />}
                      onIconClick={() => setShowPass(!showPass)}
                    />
                    {strength > 0 && (
                      <>
                        <div className="auth-strength" style={{ marginTop: 6 }}>
                          {[1, 2, 3, 4].map((i) => (
                            <div
                              key={i}
                              className="auth-strength__bar"
                              style={{ background: i <= strength ? pwCheck.color : undefined }}
                            />
                          ))}
                        </div>
                        <div
                          style={{
                            marginTop: 4, fontSize: 11, fontWeight: 600,
                            color: pwCheck.color,
                          }}
                        >
                          {pwCheck.label}
                        </div>
                        {/* Requirement checklist — only render until the
                            password is acceptable so it disappears once the
                            trader has picked a strong enough one. */}
                        {!pwCheck.acceptable && (
                          <ul style={{ marginTop: 6, padding: 0, listStyle: 'none', fontSize: 11, lineHeight: 1.6 }}>
                            {PASSWORD_REQUIREMENTS.map((req) => {
                              const ok = pwCheck.checks[req.id];
                              return (
                                <li key={req.id} style={{ color: ok ? '#22c55e' : '#9ca3af' }}>
                                  <span style={{ marginRight: 6 }}>{ok ? '✓' : '○'}</span>
                                  {req.label}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </>
                    )}
                  </motion.div>

                  <motion.div {...fadeUp(0.68)}>
                    <AuthInput
                      label="Confirm Password"
                      type={showConfirmPass ? 'text' : 'password'}
                      placeholder="Re-enter password"
                      value={form.confirmPassword}
                      onChange={(e) => update('confirmPassword', e.target.value)}
                      error={errors.confirmPassword}
                      rightIcon={showConfirmPass ? <Eye size={18} /> : <EyeOff size={18} />}
                      onIconClick={() => setShowConfirmPass(!showConfirmPass)}
                    />
                  </motion.div>

                  {/* Cloudflare Turnstile — quietly verifies that a real
                      browser is filling the form. Mostly invisible to real
                      users (Cloudflare's heuristic check passes most of the
                      time without any UI). Renders nothing if no site key
                      is configured in env. */}
                  <motion.div {...fadeUp(0.7)} style={{ marginTop: 4 }}>
                    <TurnstileWidget key={turnstileNonce} onToken={setTurnstileToken} />
                  </motion.div>

                  {/* Terms & Conditions / Privacy consent. Required —
                      submit button stays disabled until checked, and
                      submit-time validation surfaces an inline error if
                      somehow bypassed. Styled via .auth-terms in auth.css
                      so the colours match the rest of the form (green
                      accent, dark themed border, no clashing blue links). */}
                  <motion.div {...fadeUp(0.71)} style={{ marginTop: 4 }}>
                    <label className="auth-terms">
                      <input
                        type="checkbox"
                        className="auth-terms__checkbox"
                        checked={agreedToTerms}
                        onChange={(e) => {
                          setAgreedToTerms(e.target.checked);
                          if (e.target.checked) setErrors((prev) => ({ ...prev, terms: '' }));
                        }}
                      />
                      <span className="auth-terms__text">
                        I agree to the{' '}
                        <a
                          href="/terms"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="auth-terms__link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Terms &amp; Conditions
                        </a>
                        {' '}and{' '}
                        <a
                          href="/privacy"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="auth-terms__link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Privacy Policy
                        </a>
                        .
                      </span>
                    </label>
                    {errors.terms && (
                      <span className="auth-terms__error">{errors.terms}</span>
                    )}
                  </motion.div>

                  <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.72, duration: 0.4 }}>
                    <button
                      type="submit"
                      className="auth-btn"
                      disabled={loading || isLoading || !agreedToTerms}
                    >
                      {(loading || isLoading) ? <Loader2 size={18} className="auth-spinner" /> : 'Sign Up'}
                    </button>
                  </motion.div>

                  <motion.div className="auth-divider" {...fadeUp(0.74)}>
                    <span className="auth-divider__line" />
                    <span className="auth-divider__text">or</span>
                    <span className="auth-divider__line" />
                  </motion.div>

                  <motion.div {...fadeUp(0.75)}>
                    <GoogleAuthButton disabled={loading || isLoading || demoLoading} />
                  </motion.div>

                  {/* Connect wallet — hidden for now, will re-enable when wallet login is ready.
                     <motion.div {...fadeUp(0.755)}>
                       <ConnectWalletButton
                         variant="login"
                         disabled={loading || isLoading || demoLoading}
                       />
                     </motion.div> */}

                  <motion.div {...fadeUp(0.76)}>
                    <button
                      type="button"
                      onClick={handleDemo}
                      disabled={demoLoading || isLoading}
                      className="auth-btn auth-btn--outline"
                    >
                      {demoLoading ? <Loader2 size={18} className="auth-spinner" /> : 'Try with Demo Account'}
                    </button>
                  </motion.div>

                  <motion.p className="auth-footer" {...fadeUp(0.78)}>
                    Already have an account?{' '}
                    <a onClick={() => router.push('/auth/login')}>Log in</a>
                  </motion.p>
                </form>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
    </MotionConfig>
  );
}
