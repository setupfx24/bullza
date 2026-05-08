'use client';

import Link from 'next/link';
import { ArrowUpRight, CheckCircle2 } from 'lucide-react';

type Tier = {
  name: string;
  href: string;
  badge: string;
  deposit: string;
  spread: string;
  commission: string;
  desc: string;
  features: string[];
  highlight?: boolean;
};

const TIERS: Tier[] = [
  {
    name: 'Standard',
    href: '/accounts/standard',
    badge: 'Start Here',
    deposit: '$100',
    spread: 'From 1.5 pips',
    commission: 'None',
    desc: 'The perfect starting point. Simple pricing, full platform access, and everything you need to learn and grow as a trader.',
    features: ['No commission', 'Full platform access', '24/5 support', 'Demo available'],
  },
  {
    name: 'Pro',
    href: '/accounts/pro',
    badge: 'Most Popular',
    deposit: '$5,000',
    spread: 'Ultra-tight',
    commission: 'Reduced rates',
    desc: 'For serious traders demanding the best conditions. Tightest pricing, priority queue, and dedicated account support.',
    features: ['Tightest spreads available', 'Advanced analytics', 'Dedicated manager', 'Priority fills'],
    highlight: true,
  },
  {
    name: 'Demo',
    href: '/accounts/demo',
    badge: 'Risk-Free',
    deposit: '$0',
    spread: 'Live spreads',
    commission: 'None',
    desc: 'Practice with $10,000 virtual funds and identical execution conditions to a live account. No commitment.',
    features: ['$10,000 virtual balance', 'Real market spreads', 'Full platform access', 'Unlimited duration'],
  },
];

export default function AccountTypesPage() {
  return (
    <main className="relative min-h-screen bg-background overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 0%, hsl(99 55% 42% / 0.18), transparent 70%)' }}
      />

      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pt-40 pb-20 sm:pt-48 sm:pb-28 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full liquid-glass text-xs uppercase tracking-[0.18em] text-foreground/70 font-body">
          <span className="size-1.5 rounded-full bg-primary" />
          Find Your Fit
        </div>
        <h1 className="mt-6 font-display uppercase tracking-tight leading-[0.95] text-foreground text-5xl sm:text-6xl md:text-7xl">
          Accounts Designed
          <br />
          <span className="text-primary">Around You</span>
        </h1>
        <p className="mt-7 mx-auto max-w-2xl text-foreground/70 text-base sm:text-lg leading-relaxed">
          From your first trade to your ten-thousandth — SwisDex has an account built for your level.
        </p>
      </section>

      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pb-24">
        <div className="grid md:grid-cols-3 gap-5">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={`liquid-glass rounded-2xl p-7 flex flex-col ${t.highlight ? 'ring-2 ring-primary/60' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-2xl uppercase tracking-tight">{t.name}</h3>
                <span className={`text-[10px] uppercase tracking-[0.16em] px-2.5 py-1 rounded-full ${t.highlight ? 'bg-primary text-white' : 'bg-primary/25 text-primary'}`}>
                  {t.badge}
                </span>
              </div>
              <div className="mt-5 text-3xl font-display text-foreground">
                {t.deposit}
                <span className="text-sm text-foreground/55"> min</span>
              </div>
              <div className="mt-1 text-xs text-foreground/55">{t.spread} · {t.commission}</div>
              <p className="mt-4 text-sm text-foreground/65 leading-relaxed">{t.desc}</p>
              <ul className="mt-5 space-y-2 text-sm text-foreground/75 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-col gap-2">
                <Link
                  href={t.href}
                  className="inline-flex items-center justify-center gap-2 rounded-full liquid-glass px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-foreground hover:bg-foreground/5"
                >
                  Learn More <ArrowUpRight className="size-3.5" />
                </Link>
                <Link
                  href="/auth/register"
                  className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-opacity ${
                    t.highlight ? 'bg-primary text-white hover:opacity-90' : 'bg-primary/25 text-primary hover:bg-primary/40'
                  }`}
                >
                  Open {t.name} Account <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
