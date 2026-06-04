'use client';

import Link from 'next/link';
import { ArrowUpRight, ShieldCheck, Sparkles, Check } from 'lucide-react';

// Two headline offers — 50% standard cover and 70% promo cover.
// Engine supports per-trade tier selection on the order ticket; this
// page is the public marketing surface that lists what's available.
const OFFERS = [
  {
    pct: '50%',
    label: 'Standard Cover',
    fee: 'From 2% of trade size',
    bullets: [
      'Refunds up to 50% of any covered losing trade',
      'Cap up to $1,000 per policy',
      'One-click activation on every order ticket',
      'Pays out automatically the moment the position closes',
    ],
    tone: '#55a630',
  },
  {
    pct: '70%',
    label: 'Premium Cover (Promo)',
    fee: 'Limited-time offer',
    bullets: [
      'Refunds up to 70% of any covered losing trade',
      'Higher policy caps for verified accounts',
      'Same one-click activation, no paperwork',
      'Stackable with the welcome bonus on first deposits',
    ],
    tone: '#e8b923',
    featured: true,
  },
];

export default function InsurancePage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero banner — kept tighter so the page doesn't feel image-heavy. */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pt-24 sm:pt-28">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/insurance_banner1.png"
          alt="SwisDex Trade Insurance — protect every position"
          className="w-full rounded-3xl max-h-[420px] object-cover"
          style={{ border: '1px solid rgba(255,255,255,0.06)' }}
        />
      </section>

      {/* Two-tier offer section — replaces the prior placeholder. */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full liquid-glass text-xs uppercase tracking-[0.18em] text-foreground/70 font-body">
            <ShieldCheck className="size-3.5" />
            Trade Insurance Offers
          </div>
          <h2 className="mt-5 font-display uppercase text-3xl sm:text-4xl md:text-5xl tracking-tight">
            <span className="text-primary">50%</span> &amp; <span className="text-[#e8b923]">70%</span> Loss Coverage
          </h2>
          <p className="mt-4 text-foreground/70 text-sm sm:text-base">
            Activate insurance on the order ticket and get a refund if your trade
            closes at a loss. Two coverage tiers — pick the one that fits your risk.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {OFFERS.map((o) => (
            <div
              key={o.pct}
              className="relative rounded-3xl p-6 sm:p-8 liquid-glass"
              style={{
                border: `1px solid ${o.tone}40`,
                background: o.featured
                  ? `linear-gradient(180deg, ${o.tone}14, transparent)`
                  : undefined,
              }}
            >
              {o.featured && (
                <div className="absolute -top-3 right-6 flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
                     style={{ background: o.tone, color: '#0a0a0a' }}>
                  <Sparkles className="size-3" /> Limited Promo
                </div>
              )}
              <div className="flex items-baseline gap-2">
                <span className="font-display text-5xl sm:text-6xl font-bold leading-none" style={{ color: o.tone }}>
                  {o.pct}
                </span>
                <span className="text-foreground/60 text-sm">loss cover</span>
              </div>
              <div className="mt-1 text-base sm:text-lg font-semibold">{o.label}</div>
              <div className="mt-1 text-xs text-foreground/55 uppercase tracking-wider">{o.fee}</div>
              <ul className="mt-5 space-y-2.5">
                {o.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-foreground/80">
                    <Check className="size-4 mt-0.5 shrink-0" style={{ color: o.tone }} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/register"
                className="mt-7 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold uppercase tracking-wider"
                style={{ background: o.tone, color: '#0a0a0a' }}
              >
                Activate Now <ArrowUpRight className="size-4" />
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-foreground/45 max-w-2xl mx-auto">
          Insurance fees apply per trade and are non-refundable. Coverage payouts
          are subject to minimum trade duration and the policy terms shown on the
          order ticket at activation time.
        </p>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pb-20">
        <div className="liquid-glass-strong rounded-3xl p-8 sm:p-12 text-center">
          <h2 className="font-display uppercase text-2xl sm:text-3xl tracking-tight">
            Trade With Built-In Protection
          </h2>
          <p className="mt-4 text-foreground/70 max-w-xl mx-auto text-sm sm:text-base">
            Open a SwisDex account and tap Insurance on any order to lock in 50% or 70% loss cover.
          </p>
          <Link
            href="/auth/register"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary text-white px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:opacity-90"
          >
            Open Account <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
