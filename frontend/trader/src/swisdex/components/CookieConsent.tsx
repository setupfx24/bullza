'use client';

/**
 * Cookie consent dialog.
 *
 * Lifecycle (standard GDPR — dialog shows once, then is suppressed):
 *   1. On the user's FIRST visit (no localStorage entry yet), the full
 *      3-tab dialog opens automatically ~600 ms after first paint.
 *      Centered modal, dark backdrop with blur.
 *   2. The dialog has 3 tabs:
 *        - Change Settings (toggles for promotional / preference cookies;
 *          functional is always-on per the brief).
 *        - What are Cookies? (educational copy).
 *        - Why are Cookies Useful? (educational copy).
 *   3. Saving / accepting writes prefs + an ISO timestamp under
 *      `swisdex_cookie_consent`. The dialog will NOT auto-open again
 *      on subsequent visits — the user is no longer interrupted.
 *   4. Users can revisit the dialog at any time via the footer
 *      'Cookie Settings' link, which calls openCookieSettings(). The
 *      dialog re-opens with the previously saved toggles pre-loaded
 *      so the user can change their mind.
 *
 * Mounted once in src/app/layout.tsx so it shows on every route.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cookie, X, Check } from 'lucide-react';

const STORAGE_KEY = 'swisdex_cookie_consent';

/** Persisted preference object — `functional` always saves as true. */
type StoredPrefs = {
  functional: true;
  promotional: boolean;
  preference: boolean;
  savedAt: string;
};

type EditablePrefs = {
  functional: true;
  promotional: boolean;
  preference: boolean;
};

const DEFAULT_PREFS: EditablePrefs = {
  functional: true,
  promotional: false,
  preference: false,
};

function readPrefs(): StoredPrefs | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredPrefs;
  } catch {
    return null;
  }
}

function writePrefs(prefs: EditablePrefs) {
  if (typeof window === 'undefined') return;
  try {
    const full: StoredPrefs = { ...prefs, savedAt: new Date().toISOString() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(full));
  } catch {
    /* ignore — private browsing, quota full, etc. */
  }
}

/** Global re-open hook — call from the footer / nav to surface the
 *  settings modal even after the user already saved a preference. */
export function openCookieSettings() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('swisdex:open-cookie-settings'));
}

type Tab = 'settings' | 'what' | 'why';

export function CookieConsent() {
  const [mounted, setMounted] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [tab, setTab] = useState<Tab>('settings');
  const [prefs, setPrefs] = useState<EditablePrefs>(DEFAULT_PREFS);

  // Show a slim BOTTOM banner (not a centered modal) when no preference
  // is saved yet — like the consent bars on major financial sites. The
  // detailed 3-tab dialog never auto-opens; it surfaces only when the
  // user clicks "Manage cookies" in the banner or the footer link. Once
  // the user Accepts / Refuses / Saves, the localStorage entry suppresses
  // the banner on every subsequent visit (no more repeated pop-ups).
  useEffect(() => {
    setMounted(true);
    const existing = readPrefs();
    if (existing) {
      setPrefs({
        functional: true,
        promotional: existing.promotional,
        preference: existing.preference,
      });
      return;
    }
    // No saved preference → slide the banner up 600 ms after first paint
    // so the splash overlay finishes first.
    const t = window.setTimeout(() => setShowBanner(true), 600);
    return () => window.clearTimeout(t);
  }, []);

  // Listen for footer/nav-triggered open events (re-open settings modal).
  useEffect(() => {
    const handler = () => setShowModal(true);
    window.addEventListener('swisdex:open-cookie-settings', handler);
    return () => window.removeEventListener('swisdex:open-cookie-settings', handler);
  }, []);

  // Lock body scroll while the detailed modal is open.
  useEffect(() => {
    if (!showModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [showModal]);

  const acceptAll = () => {
    const all: EditablePrefs = { functional: true, promotional: true, preference: true };
    setPrefs(all);
    writePrefs(all);
    setShowModal(false);
    setShowBanner(false);
  };

  // Refuse = keep only the essential functional cookies (always-on), opt
  // out of promotional + preference. Persists like Accept so the banner
  // doesn't return.
  const refuseAll = () => {
    const minimal: EditablePrefs = { functional: true, promotional: false, preference: false };
    setPrefs(minimal);
    writePrefs(minimal);
    setShowModal(false);
    setShowBanner(false);
  };

  const saveAndClose = () => {
    writePrefs(prefs);
    setShowModal(false);
    setShowBanner(false);
  };

  // Closing the modal via X just hides the modal; the banner stays so the
  // user still makes an explicit choice (ePrivacy "no implicit consent").
  const dismiss = () => setShowModal(false);

  if (!mounted) return null;

  return (
    <>
      {/* Slim bottom consent banner (replaces the auto-opening modal). */}
      <AnimatePresence>
        {showBanner && !showModal && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-0 bottom-0 z-[200] p-3 sm:p-4"
            role="region"
            aria-label="Cookie consent"
          >
            <div
              className="mx-auto max-w-[1200px] rounded-2xl px-4 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-6"
              style={{
                background: 'linear-gradient(180deg, #0d1014 0%, #07090c 100%)',
                border: '1px solid rgba(85,166,48,0.35)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
              }}
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div
                  className="size-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(85,166,48,0.18)', border: '1px solid rgba(85,166,48,0.4)' }}
                >
                  <Cookie className="size-4" style={{ color: '#55a630' }} />
                </div>
                <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  We use cookies to keep SwisDex secure, run essential trading services, and improve your
                  experience.{' '}
                  <button
                    type="button"
                    onClick={() => setShowModal(true)}
                    className="underline underline-offset-2 font-semibold"
                    style={{ color: '#55a630' }}
                  >
                    Manage cookies
                  </button>
                  {' · '}
                  <a href="/terms" className="underline underline-offset-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    Terms of Use
                  </a>
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 lg:justify-end">
                <button
                  type="button"
                  onClick={refuseAll}
                  className="flex-1 lg:flex-none rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity"
                  style={{ color: 'rgba(255,255,255,0.9)', background: 'transparent', border: '1px solid rgba(255,255,255,0.25)' }}
                >
                  Refuse
                </button>
                <button
                  type="button"
                  onClick={acceptAll}
                  className="flex-1 lg:flex-none rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity"
                  style={{ background: '#55a630', color: '#ffffff' }}
                >
                  Accept
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full cookie-settings dialog. */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[250] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
            role="dialog"
            aria-modal="true"
            aria-label="Your cookie settings"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-2xl max-h-[80vh] rounded-3xl flex flex-col overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, #0d1014 0%, #05070a 100%)',
                border: '1px solid rgba(85,166,48,0.35)',
                boxShadow: '0 30px 80px rgba(0,0,0,0.7)',
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="size-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: 'rgba(85,166,48,0.18)',
                      border: '1px solid rgba(85,166,48,0.4)',
                    }}
                  >
                    <Cookie className="size-5" style={{ color: '#55a630' }} />
                  </div>
                  <h2
                    className="font-display uppercase tracking-tight text-base sm:text-lg"
                    style={{ color: '#ffffff' }}
                  >
                    Your Cookie Settings
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="size-9 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                  style={{ color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.04)' }}
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Tabs — pill style, no border-bottom clipping. Wraps on
                  narrow screens so 'Why are Cookies Useful?' never goes
                  off-canvas. */}
              <div
                className="flex flex-wrap gap-1.5 px-5 sm:px-6 py-3"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
              >
                {(
                  [
                    ['settings', 'Change Settings'],
                    ['what',     'What are Cookies?'],
                    ['why',      'Why are Cookies Useful?'],
                  ] as const
                ).map(([key, label]) => {
                  const active = tab === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTab(key)}
                      className="px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap"
                      style={{
                        color: active ? '#ffffff' : 'rgba(255,255,255,0.6)',
                        background: active ? 'rgba(85,166,48,0.22)' : 'transparent',
                        border: active
                          ? '1px solid rgba(85,166,48,0.6)'
                          : '1px solid rgba(255,255,255,0.1)',
                      }}
                      aria-pressed={active}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
                {tab === 'settings' && <SettingsTab prefs={prefs} setPrefs={setPrefs} />}
                {tab === 'what' && <WhatTab />}
                {tab === 'why' && <WhyTab />}
              </div>

              {/* Footer */}
              <div
                className="px-5 sm:px-6 py-4 flex flex-col sm:flex-row gap-3 sm:justify-end"
                style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
              >
                <button
                  type="button"
                  onClick={saveAndClose}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity"
                  style={{
                    color: 'rgba(255,255,255,0.9)',
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.2)',
                  }}
                >
                  Save Settings and Close
                </button>
                <button
                  type="button"
                  onClick={acceptAll}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity"
                  style={{ background: '#55a630', color: '#ffffff' }}
                >
                  Enable All Cookies and Close <Check className="size-3.5" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ── Tabs ─────────────────────────────────────────────────────────── */

function SettingsTab({
  prefs,
  setPrefs,
}: {
  prefs: EditablePrefs;
  setPrefs: (p: EditablePrefs) => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
        Please select which types of cookies you would like SwisDex to store on your device.
      </p>

      <CookieRow
        title="Functional Cookies"
        required
        on
        status="Always Active"
        description="These cookies are essential for the operation of the SwisDex website, Client Portal, Partner Portal, and trading services. Without these cookies, certain features and services may not function correctly."
        examples={[
          'User authentication',
          'Login session management',
          'Security verification',
          'Fraud prevention',
          'Platform performance and stability',
        ]}
        trailing="These cookies cannot be disabled because they are necessary for the provision of our services."
      />

      <CookieRow
        title="Promotional Cookies"
        on={prefs.promotional}
        onToggle={() => setPrefs({ ...prefs, promotional: !prefs.promotional })}
        status="Optional"
        description="Promotional cookies are used to track visitors across websites and marketing channels. These cookies help SwisDex measure advertising performance, evaluate partner campaigns, and display relevant promotional content."
        examples={[
          'Affiliate tracking',
          'Introducing Broker tracking',
          'Advertising campaign measurement',
          'Marketing attribution',
          'Retargeting and remarketing activities',
        ]}
        trailing="These cookies may be placed by SwisDex or approved third-party advertising providers."
      />

      <CookieRow
        title="Preference Cookies"
        on={prefs.preference}
        onToggle={() => setPrefs({ ...prefs, preference: !prefs.preference })}
        status="Optional"
        description="Preference cookies enable SwisDex to remember information that changes the way our website behaves or appears."
        examples={[
          'Language preferences',
          'Regional settings',
          'User interface customization',
          'Trading dashboard preferences',
          'Website display settings',
        ]}
        trailing="These cookies help provide a more personalized user experience."
      />
    </div>
  );
}

function WhatTab() {
  return (
    <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
      <h3
        className="font-display uppercase tracking-tight text-lg"
        style={{ color: '#ffffff' }}
      >
        What are Cookies?
      </h3>
      <p>
        Cookies are small text files that are stored on your computer, mobile device, or tablet when
        you visit a website. They help websites recognize your device and remember information about
        your visit.
      </p>
      <p>
        Cookies may be temporary (session cookies) that expire when you close your browser, or
        persistent cookies that remain on your device for a specified period.
      </p>
      <p>
        SwisDex uses cookies to improve security, enhance functionality, analyze website
        performance, and provide a better overall user experience.
      </p>
    </div>
  );
}

function WhyTab() {
  return (
    <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
      <h3
        className="font-display uppercase tracking-tight text-lg"
        style={{ color: '#ffffff' }}
      >
        Why are Cookies Useful?
      </h3>
      <p>Cookies help SwisDex provide secure, efficient, and personalized services.</p>
      <div>
        <p className="font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.9)' }}>
          They allow us to:
        </p>
        <ul className="space-y-1.5 ml-1">
          {[
            'Maintain secure login sessions',
            'Protect client accounts against unauthorized access',
            'Improve website performance',
            'Remember user preferences',
            'Analyze website usage patterns',
            'Measure marketing effectiveness',
            'Enhance the overall client experience',
          ].map((p) => (
            <li key={p} className="flex items-start gap-2">
              <span
                aria-hidden
                className="size-1.5 mt-2 rounded-full shrink-0"
                style={{ background: '#55a630' }}
              />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
      <p>
        Cookies also help us comply with security, regulatory, and operational requirements
        applicable to financial services providers.
      </p>
      <p>
        By understanding how visitors interact with our website, we can continually improve our
        products, trading services, and customer support experience.
      </p>
    </div>
  );
}

/* ── Primitives ───────────────────────────────────────────────────── */

function CookieRow({
  title,
  on,
  onToggle,
  required,
  status,
  description,
  examples,
  trailing,
}: {
  title: string;
  on: boolean;
  onToggle?: () => void;
  required?: boolean;
  status: string;
  description: string;
  examples: string[];
  trailing?: string;
}) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="flex items-start sm:items-center justify-between gap-4 mb-3">
        <h3
          className="font-semibold text-base flex items-center gap-2 flex-wrap"
          style={{ color: '#ffffff' }}
        >
          {title}
          {required && (
            <span
              className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full"
              style={{
                color: '#55a630',
                background: 'rgba(85,166,48,0.18)',
                border: '1px solid rgba(85,166,48,0.4)',
              }}
            >
              Required
            </span>
          )}
        </h3>
        <Toggle on={on} disabled={required} onClick={onToggle} />
      </div>
      <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
        {description}
      </p>
      <div className="mt-3">
        <p className="text-[11px] uppercase tracking-[0.14em] mb-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Examples
        </p>
        <ul className="space-y-1 text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
          {examples.map((e) => (
            <li key={e} className="flex items-start gap-2">
              <span
                aria-hidden
                className="size-1.5 mt-2 rounded-full shrink-0"
                style={{ background: '#55a630' }}
              />
              <span>{e}</span>
            </li>
          ))}
        </ul>
      </div>
      {trailing && (
        <p
          className="mt-3 text-xs leading-relaxed italic"
          style={{ color: 'rgba(255,255,255,0.55)' }}
        >
          {trailing}
        </p>
      )}
      <p className="mt-3 text-xs">
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>Status: </span>
        <span
          className="font-semibold"
          style={{ color: required ? '#55a630' : 'rgba(255,255,255,0.9)' }}
        >
          {status}
        </span>
      </p>
    </div>
  );
}

/**
 * iOS-style pill toggle — classic Tailwind / Headless-UI pattern.
 *
 * Track is `inline-flex items-center` so the knob (an inline-block span)
 * sits vertically centred without needing absolute positioning. Sliding
 * is done with `translate-x` rather than left/top so it never drifts past
 * the track edge on any browser. The required (Functional) row disables
 * the button + dims it; the other two rows toggle through onClick.
 */
function Toggle({
  on,
  onClick,
  disabled,
}: {
  on: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
        disabled ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
      }`}
      style={{
        background: on ? '#55a630' : 'rgba(255,255,255,0.22)',
        border: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      <span
        aria-hidden
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
          on ? 'translate-x-6' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
