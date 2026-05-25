'use client';

import { useEffect, useState } from 'react';

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
    const fade = setTimeout(() => setHidden(true), 1500);
    const remove = setTimeout(() => setRemoved(true), 2150);
    return () => { clearTimeout(fade); clearTimeout(remove); };
  }, []);

  if (removed) return null;

  return (
    <div className={`swisdex-splash${hidden ? ' swisdex-splash--hidden' : ''}`} aria-hidden="true">
      {/* Soft background aura — feb.png, blurred + low opacity */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/feb.png" alt="" className="swisdex-splash__bg" />

      <div className="swisdex-splash__inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/swisdex_png5.png" alt="SwisDex" className="swisdex-splash__logo" />
        <span className="swisdex-splash__ring" />
      </div>
    </div>
  );
}
