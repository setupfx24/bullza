'use client';

import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Check, X } from 'lucide-react';

/**
 * Custom language switcher that drives Google Translate Element under the
 * hood. Default site language is English; selecting another translates the
 * whole DOM client-side via Google's widget.
 *
 * Implementation:
 *  - Google Translate's official Element JS is loaded once at <head> via
 *    layout.tsx, with `googleTranslateElementInit` defined on window.
 *  - Default UI is hidden via CSS overrides in globals.css.
 *  - This component renders a globe button + modal grid; on selection it
 *    programmatically dispatches `change` on the hidden `.goog-te-combo`
 *    select so Google's widget swaps the page text.
 *  - Cookie `googtrans=/en/<lang>` persists the choice across reloads.
 */

interface Language {
  code: string;       // Google Translate code
  label: string;
  flag: string;       // emoji flag (display-only)
}

const LANGUAGES: Language[] = [
  { code: 'en',    label: 'English',     flag: '🇬🇧' },
  { code: 'ms',    label: 'Malay',       flag: '🇲🇾' },
  { code: 'zh-CN', label: '简体中文',     flag: '🇨🇳' },
  { code: 'zh-TW', label: '繁體中文',     flag: '🇭🇰' },
  { code: 'el',    label: 'Ελληνικά',    flag: '🇬🇷' },
  { code: 'hu',    label: 'Magyar',      flag: '🇭🇺' },
  { code: 'ru',    label: 'Русский',     flag: '🇷🇺' },
  { code: 'id',    label: 'Indonesia',   flag: '🇮🇩' },
  { code: 'fr',    label: 'Français',    flag: '🇫🇷' },
  { code: 'it',    label: 'Italiano',    flag: '🇮🇹' },
  { code: 'sv',    label: 'Svenska',     flag: '🇸🇪' },
  { code: 'de',    label: 'Deutsch',     flag: '🇩🇪' },
  { code: 'pl',    label: 'Polski',      flag: '🇵🇱' },
  { code: 'ar',    label: 'العربية',     flag: '🇸🇦' },
  { code: 'es',    label: 'Español',     flag: '🇪🇸' },
  { code: 'ko',    label: '한국어',       flag: '🇰🇷' },
  { code: 'pt',    label: 'Português',   flag: '🇵🇹' },
  { code: 'vi',    label: 'Tiếng Việt',  flag: '🇻🇳' },
  { code: 'th',    label: 'ภาษาไทย',     flag: '🇹🇭' },
  { code: 'fil',   label: 'Filipino',    flag: '🇵🇭' },
  { code: 'nl',    label: 'Dutch',       flag: '🇳🇱' },
  { code: 'cs',    label: 'Česky',       flag: '🇨🇿' },
  { code: 'bn',    label: 'বাংলা',        flag: '🇧🇩' },
  { code: 'ur',    label: 'اردو',         flag: '🇵🇰' },
  { code: 'tr',    label: 'Türkçe',      flag: '🇹🇷' },
  { code: 'hi',    label: 'हिंदी',         flag: '🇮🇳' },
  { code: 'si',    label: 'සිංහල',       flag: '🇱🇰' },
  { code: 'uz',    label: "O'zbekcha",   flag: '🇺🇿' },
  { code: 'mn',    label: 'Монгол',      flag: '🇲🇳' },
];

const COOKIE_NAME = 'googtrans';

function readActiveLang(): string {
  if (typeof document === 'undefined') return 'en';
  const m = document.cookie.match(/(?:^|; )googtrans=([^;]+)/);
  if (!m) return 'en';
  // Cookie format: /en/<target>
  const parts = decodeURIComponent(m[1]).split('/');
  return parts[2] || 'en';
}

function setActiveLang(lang: string) {
  if (typeof document === 'undefined') return;
  // Set on both the current domain and its parent (so subdomains share).
  const value = `/en/${lang}`;
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${60 * 60 * 24 * 365}`;
  const host = window.location.hostname.replace(/^www\./, '');
  document.cookie = `${COOKIE_NAME}=${value}; path=/; domain=.${host}; max-age=${60 * 60 * 24 * 365}`;
}

export function LanguageSwitcher() {
  const [open, setOpen]     = useState(false);
  const [active, setActive] = useState('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setActive(readActiveLang());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const pick = useCallback((code: string) => {
    setActive(code);
    setActiveLang(code);
    // Drive Google's hidden select. If not yet present (initial visit), set
    // the cookie + reload so Google honours the target language on boot.
    const select = document.querySelector<HTMLSelectElement>('.goog-te-combo');
    if (select) {
      select.value = code;
      select.dispatchEvent(new Event('change'));
    } else {
      window.location.reload();
    }
    setOpen(false);
  }, []);

  const activeLabel = LANGUAGES.find((l) => l.code === active)?.label ?? 'English';
  const activeFlag  = LANGUAGES.find((l) => l.code === active)?.flag  ?? '🇬🇧';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Change language. Current: ${activeLabel}`}
        className="inline-flex items-center gap-1.5 rounded-full liquid-glass px-3 py-1.5 text-xs font-semibold text-foreground/85 hover:text-foreground transition-colors notranslate"
        translate="no"
      >
        <Globe className="size-4" />
        <span className="hidden sm:inline">{activeFlag}</span>
        <span className="hidden md:inline uppercase tracking-wider">{active}</span>
      </button>

      {mounted && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Select language"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="swisdex-home fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm notranslate"
              translate="no"
              onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 10 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="liquid-glass-strong rounded-3xl p-5 sm:p-8 max-w-5xl w-full max-h-[90vh] overflow-y-auto [backdrop-filter:blur(40px)]"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-primary/25 flex items-center justify-center">
                      <Globe className="size-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-display uppercase text-lg sm:text-xl tracking-tight">Choose Language</h2>
                      <p className="text-xs text-foreground/55">Powered by Google Translate · {LANGUAGES.length} languages</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => setOpen(false)}
                    className="size-9 rounded-full liquid-glass flex items-center justify-center text-foreground hover:bg-foreground/5"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {LANGUAGES.map((lang) => {
                    const isActive = lang.code === active;
                    return (
                      <li key={lang.code}>
                        <button
                          type="button"
                          onClick={() => pick(lang.code)}
                          className={`w-full inline-flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-colors text-left ${
                            isActive
                              ? 'bg-primary/25 text-primary font-semibold'
                              : 'text-foreground/85 hover:bg-foreground/5'
                          }`}
                          aria-pressed={isActive}
                        >
                          <span className="text-base shrink-0" aria-hidden>{lang.flag}</span>
                          <span className="flex-1 truncate">{lang.label}</span>
                          {isActive && <Check className="size-4 shrink-0" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
