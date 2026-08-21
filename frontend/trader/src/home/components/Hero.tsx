'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import {
  ArrowUpRight,
  BadgeCheck,
  Network,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { LiveTickerBar } from './LiveTickerBar';
import { HERO, HERO_TRUST_PILLS, SIGNUP_HREF } from '../data';
import { BRAND_NAME } from '@/lib/brand';

/* Only the icons the hero pills actually reference — keeps the client
   bundle off the full lucide catalogue. */
const iconMap: Record<string, LucideIcon> = { Network, ShieldCheck, BadgeCheck };

/** Shared entrance transition; the global reduced-motion guard in
 *  marketing/tokens.css neutralises it for users who ask for that. */
const rise = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
});

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Soft coral bloom behind the headline — pure CSS, no image, no WebGL. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(58% 46% at 50% 6%, var(--mk-accent-soft) 0%, transparent 70%)',
        }}
      />
      {/* Faint hairline grid, fading out before it reaches the fold. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(var(--mk-line) 1px, transparent 1px), linear-gradient(90deg, var(--mk-line) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage: 'radial-gradient(70% 60% at 50% 0%, #000 0%, transparent 78%)',
          WebkitMaskImage: 'radial-gradient(70% 60% at 50% 0%, #000 0%, transparent 78%)',
        }}
      />

      <div
        className="mk-container relative flex flex-col items-center text-center"
        style={{
          paddingTop: 'clamp(7rem, 5rem + 9vw, 11rem)',
          paddingBottom: 'var(--mk-section-y)',
          gap: 'var(--mk-space-5)',
        }}
      >
        <motion.span {...rise(0.05)} className="mk-kicker">
          <span className="relative inline-flex items-center justify-center" aria-hidden>
            <span
              className="absolute size-1.5 rounded-full animate-ping opacity-75"
              style={{ background: 'var(--mk-accent)' }}
            />
            <span className="relative size-1.5 rounded-full" style={{ background: 'var(--mk-accent)' }} />
          </span>
          {HERO.pill}
        </motion.span>

        <motion.h1
          {...rise(0.12)}
          style={{
            fontSize: 'var(--mk-text-display)',
            lineHeight: 'var(--mk-leading-tight)',
            letterSpacing: '-0.03em',
            fontWeight: 800,
            maxWidth: '16ch',
          }}
        >
          {HERO.headline}
        </motion.h1>

        <motion.p {...rise(0.2)} className="mk-lead" style={{ maxWidth: '58ch' }}>
          {HERO.sub}
        </motion.p>

        <motion.div
          {...rise(0.28)}
          className="flex flex-wrap items-center justify-center"
          style={{ gap: 'var(--mk-space-3)', paddingTop: 'var(--mk-space-2)' }}
        >
          <Link href={SIGNUP_HREF} className="mk-btn mk-btn--primary">
            {HERO.ctaPrimary}
            <ArrowUpRight size={16} />
          </Link>
          <Link href={HERO.ctaSecondaryHref} className="mk-btn mk-btn--ghost">
            {HERO.ctaSecondary}
          </Link>
        </motion.div>

        {/* Standing first-deposit offer — the /bonus route stays reachable. */}
        <motion.div
          {...rise(0.36)}
          className="inline-flex flex-wrap items-center justify-center rounded-full"
          style={{
            gap: 'var(--mk-space-2)',
            padding: '0.4rem 0.5rem 0.4rem 0.85rem',
            background: 'var(--mk-accent-soft)',
            border: '1px solid var(--mk-accent-line)',
          }}
        >
          <span
            className="font-semibold uppercase"
            style={{
              fontSize: 'var(--mk-text-xs)',
              letterSpacing: '0.1em',
              color: 'var(--mk-text)',
            }}
          >
            {HERO.bonusLabel}
          </span>
          <Link
            href={HERO.bonusHref}
            className="inline-flex items-center gap-1 font-bold uppercase rounded-full px-2.5 py-1 transition-colors"
            style={{
              fontSize: 'var(--mk-text-xs)',
              letterSpacing: '0.1em',
              color: 'var(--mk-accent)',
              background: 'rgba(0,0,0,0.25)',
            }}
          >
            {HERO.bonusCta}
            <ArrowUpRight size={13} />
          </Link>
        </motion.div>

        {/* What we are, in three lines — no numbers, no unverifiable claims. */}
        <motion.ul
          {...rise(0.44)}
          className="grid w-full grid-cols-1 sm:grid-cols-3 text-left"
          style={{ gap: 'var(--mk-space-4)', marginTop: 'var(--mk-space-5)' }}
        >
          {HERO_TRUST_PILLS.map(({ icon, label, sub }) => {
            const Icon = iconMap[icon] ?? ShieldCheck;
            return (
              <li key={label} className="mk-card flex items-start" style={{ gap: 'var(--mk-space-3)', padding: 'var(--mk-space-5)' }}>
                <span
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
                >
                  <Icon size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block font-bold" style={{ fontSize: 'var(--mk-text-sm)' }}>
                    {label}
                  </span>
                  <span
                    className="block"
                    style={{ fontSize: 'var(--mk-text-xs)', color: 'var(--mk-text-faint)', marginTop: 2 }}
                  >
                    {sub}
                  </span>
                </span>
              </li>
            );
          })}
        </motion.ul>
      </div>

      <p className="sr-only">
        {BRAND_NAME} — decentralized exchange, insured trades and broker-grade
        execution for forex and crypto.
      </p>

      {/* Real market data, straight from the TradingView tape. */}
      <LiveTickerBar />
    </section>
  );
}
