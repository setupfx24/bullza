'use client';

import Link from 'next/link';
import { ArrowUpRight, Award, Crown, Gem, Sparkles } from 'lucide-react';

/**
 * IB Account Type tier structure — content per the client spec sheet
 * delivered 2026-06. Replaces the previous 50% / 70% loss-cover offer
 * cards on this page. Each tier is gated by an "active traders"
 * threshold and carries a per-lot commission + tier reward "amount".
 * The Platinum tier is the entry point for the custom-deal program
 * (up to $15 / lot) called out in the callout banner below the grid.
 */
const IB_TIERS = [
  {
    tier: 'Bronze',
    traders: '+5',
    commission: '$5',
    amount: '$500',
    tone: '#cd7f32',
    Icon: Award,
  },
  {
    tier: 'Silver',
    traders: '+20',
    commission: '$7',
    amount: '$5,000',
    tone: '#c0c0c0',
    Icon: Award,
  },
  {
    tier: 'Gold',
    traders: '+50',
    commission: '$10',
    amount: '$20,000',
    tone: '#e8b923',
    Icon: Crown,
    featured: true,
  },
  {
    tier: 'Platinum',
    traders: '+100',
    commission: '$12',
    amount: '$50,000',
    tone: '#e5e4e2',
    Icon: Gem,
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

      {/* IB Account Type tier grid — replaces the prior 50%/70% offer cards. */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full liquid-glass text-xs uppercase tracking-[0.18em] text-foreground/70 font-body">
            <Crown className="size-3.5" />
            IB Account Tiers
          </div>
          <h2 className="mt-5 font-display uppercase text-3xl sm:text-4xl md:text-5xl tracking-tight">
            Bronze. Silver. <span className="text-primary">Gold.</span> Platinum.
          </h2>
          <p className="mt-4 text-foreground/70 text-sm sm:text-base">
            Per-lot commission scales with the number of active traders you bring on.
            Move up automatically — no manual upgrade. Top earners qualify for custom
            deals up to <span className="text-primary font-semibold">$15 per lot</span>.
          </p>
        </div>

        {/* Tier cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {IB_TIERS.map(({ tier, traders, commission, amount, tone, Icon, featured }) => (
            <div key={tier} className={`relative ${featured ? 'mt-3 lg:mt-0' : ''}`}>
              {featured && (
                <div
                  className="absolute -top-3 right-6 z-10 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shadow-lg"
                  style={{ background: tone, color: '#0a0a0a' }}
                >
                  <Sparkles className="size-3" /> Most Popular
                </div>
              )}
              <div
                className="rounded-3xl p-6 liquid-glass flex flex-col h-full"
                style={{
                  border: `1px solid ${tone}55`,
                  background: featured ? `linear-gradient(180deg, ${tone}14, transparent)` : undefined,
                }}
              >
                <div
                  className="size-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${tone}22`, border: `1px solid ${tone}55` }}
                >
                  <Icon className="size-5" style={{ color: tone }} />
                </div>

                <div className="font-display text-2xl uppercase tracking-tight" style={{ color: tone }}>
                  {tier}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-foreground/55">
                  IB Account Type
                </div>

                <div className="mt-5 pt-5 border-t border-foreground/10 space-y-3 flex-1">
                  <StatRow label="Active Traders"        value={traders} />
                  <StatRow label="Commission (per lot)"  value={commission} accent={tone} />
                  <StatRow label="Amount"                value={amount} />
                </div>

                <Link
                  href="/products/ib-referral#apply"
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity"
                  style={{ background: tone, color: '#0a0a0a' }}
                >
                  Apply for IB <ArrowUpRight className="size-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Top custom-deals callout */}
        <div
          className="mt-8 mx-auto max-w-3xl rounded-2xl p-5 sm:p-6 flex items-start gap-4"
          style={{
            background: 'hsl(99 55% 42% / 0.12)',
            border: '1px solid hsl(99 55% 42% / 0.45)',
          }}
        >
          <Sparkles className="size-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm sm:text-base text-foreground/85 leading-relaxed">
            <span className="font-semibold text-primary">Top custom deals up to $15 per lot.</span>{' '}
            Partners with consistent volume above the Platinum threshold can negotiate
            bespoke commission, marketing budget, and bonus structures with our partner team.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-foreground/45 max-w-2xl mx-auto">
          Tier qualification is reviewed monthly based on the active-trader count maintained
          across the prior 30 days. Commissions settle instantly to your IB wallet.
        </p>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pb-20">
        <div className="liquid-glass-strong rounded-3xl p-8 sm:p-12 text-center">
          <h2 className="font-display uppercase text-2xl sm:text-3xl tracking-tight">
            Start Earning As An IB
          </h2>
          <p className="mt-4 text-foreground/70 max-w-xl mx-auto text-sm sm:text-base">
            Apply once, get approved within 24 hours, then earn lifetime per-lot commissions on every trade your referrals place.
          </p>
          <Link
            href="/products/ib-referral#apply"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary text-white px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:opacity-90"
          >
            Apply Now <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}

function StatRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] uppercase tracking-[0.14em] text-foreground/55">{label}</span>
      <span
        className="font-display text-base tabular-nums"
        style={{ color: accent || '#ffffff' }}
      >
        {value}
      </span>
    </div>
  );
}
