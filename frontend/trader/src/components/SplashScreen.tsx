'use client';

import { useEffect, useState } from 'react';
import { BRAND_LOGO, BRAND_NAME } from '@/lib/brand';

/**
 * Full-screen branded splash shown on every full page load / refresh.
 *
 * Because this is mounted once in the root layout, its mount effect runs
 * only on a real page load — client-side route changes (next/link) do NOT
 * remount it, so the splash never reappears while navigating the SPA.
 *
 * Renders immediately (covers first paint), holds for a beat while the
 * logo animates, then fades out and unmounts so it never blocks clicks.
 */
export default function SplashScreen() {
  const [hidden, setHidden] = useState(false);   // triggers the fade-out
  const [removed, setRemoved] = useState(false);  // unmounts after fade

  useEffect(() => {
    // Short hold + quick fade so the splash is barely a flicker — pages
    // appear almost instantly instead of being blocked for ~1.5s.
    const fade = setTimeout(() => setHidden(true), 250);
    const remove = setTimeout(() => setRemoved(true), 650);
    return () => { clearTimeout(fade); clearTimeout(remove); };
  }, []);

  if (removed) return null;

  return (
    <div className={`brand-splash${hidden ? ' brand-splash--hidden' : ''}`} aria-hidden="true">
      {BRAND_LOGO ? (
        <>
          {/* Soft background aura — brand logo, blurred + low opacity */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BRAND_LOGO} alt="" className="brand-splash__bg" />

          <div className="brand-splash__inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BRAND_LOGO} alt={BRAND_NAME} className="brand-splash__logo" />
          </div>
        </>
      ) : (
        /* No logo configured — styled text wordmark fallback. */
        <div className="brand-splash__inner">
          <span className="brand-splash__logo brand-splash__wordmark">{BRAND_NAME}</span>
        </div>
      )}
    </div>
  );
}
