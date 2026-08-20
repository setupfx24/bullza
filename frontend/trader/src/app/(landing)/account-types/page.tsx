'use client';

import Link from 'next/link';
import { ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';

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
    deposit: '$50',
    spread: 'From 1.1 pips',
    commission: 'None',
    desc: 'Designed for new traders. Competitive spreads, zero commission, full platform access, and 24/7 multilingual support.',
    features: ['Competitive spreads from 1.1 pips', 'Zero commission', 'Full platform access', '24/7 multilingual support'],
  },
  {
    name: 'ECN',
    href: '/accounts/standard',
    badge: 'Most Popular',
    deposit: '$200',
    spread: 'From 0.0 pips',
    commission: 'Ultra-low per lot',
    desc: 'Raw spreads for serious traders. Direct liquidity access with the tightest pricing — scalping and algo trading welcome.',
    features: ['Raw spreads from 0.0 pips', 'Direct liquidity access', 'Ultra-low commission per lot', 'Scalping and algo trading allowed'],
    highlight: true,
  },
  {
    name: 'IB',
    href: '/products/ib-referral',
    badge: 'Partner',
    deposit: '$50',
    spread: 'Lifetime commissions',
    commission: 'Multi-tier earnings',
    desc: 'For partners and introducing brokers. Lifetime per-lot commissions, multi-tier earnings, and a dedicated partner manager.',
    features: ['Lifetime per-lot commissions', 'Multi-tier earnings', 'Marketing kit and dashboard', 'Dedicated partner manager'],
  },
  {
    name: 'Swap',
    href: '/accounts/swap',
    badge: 'Swap-Free',
    deposit: '$200',
    spread: 'From 0.8 pips',
    commission: 'No swap charges',
    desc: 'Sharia-compliant swap-free account. Hold positions overnight with zero swap or rollover interest — built for faith-based and long-term traders.',
    features: ['Zero overnight swap charges', 'Sharia-compliant trading', 'Full platform & instrument access', 'Hold positions indefinitely'],
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

      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pt-32 pb-12 sm:pt-40 sm:pb-20 md:pt-48 md:pb-28 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full liquid-glass text-xs uppercase tracking-[0.18em] text-foreground/70 font-body">
          <span className="size-1.5 rounded-full bg-primary" />
          Find Your Fit
        </div>
        <h1 className="mt-6 font-display uppercase tracking-tight leading-[0.95] text-foreground text-3xl sm:text-5xl md:text-6xl lg:text-7xl break-words">
          Accounts Designed
          <br />
          <span className="text-primary">Around You</span>
        </h1>
        <p className="mt-7 mx-auto max-w-2xl text-foreground/70 text-base sm:text-lg leading-relaxed">
          From your first trade to your ten-thousandth — {BRAND_NAME} has an account built for your level.
        </p>
      </section>

      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pb-24">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
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

      <FeatureComparison />
    </main>
  );
}

const COLUMN_HEADERS = [
  { name: 'Standard', gradient: 'linear-gradient(180deg, #1f2937 0%, #0a0a0a 100%)' }, // neutral slate
  { name: 'ECN',      gradient: 'linear-gradient(180deg, #55a630 0%, #1a3210 100%)' }, // brand green (popular)
  { name: 'IB',       gradient: 'linear-gradient(180deg, #2c3e50 0%, #0e1418 100%)' }, // partner navy
  { name: 'Swap',     gradient: 'linear-gradient(180deg, #d00000 0%, #3d0000 100%)' }, // brand red (swap-free / Islamic)
];

const INSTRUMENTS = ['Forex', 'Metal', 'Crypto', 'Energies', 'Stocks', 'Indices'];

const FEATURE_ROWS: Array<{ label: string; values: React.ReactNode[] }> = [
  { label: 'Minimum Deposit',  values: ['$50', '$200', '$50', '$200'] },
  { label: 'Spread',           values: ['From 1.1 pips', 'From 0.0 pips', 'From 0.8 pips', 'From 0.8 pips'] },
  { label: 'Commission',       values: ['No Commission', 'Ultra-low per lot', 'Lifetime per-lot earnings', 'No swap charges'] },
  { label: 'Maximum Leverage', values: ['1:1000', '1:1000', '1:1000', '1:1000'] },
  {
    label: 'Instruments',
    values: [0, 1, 2, 3].map((i) => (
      <div key={i} className="flex flex-wrap justify-center gap-1.5 max-w-[220px] mx-auto">
        {INSTRUMENTS.map((inst) => (
          <span key={inst} className="text-[11px] px-2.5 py-0.5 rounded-full liquid-glass text-foreground/85">
            {inst}
          </span>
        ))}
      </div>
    )),
  },
  { label: 'Minimum lot size',           values: ['0.01', '0.01', '0.01', '0.01'] },
  { label: 'Maximum Number of positions', values: ['Unlimited', 'Unlimited', 'Unlimited', 'Unlimited'] },
  { label: 'Hedged Margin',              values: ['0%', '0%', '0%', '0%'] },
  { label: 'Margin call',                values: ['30%', '30%', '30%', '30%'] },
  { label: 'Stop out',                   values: ['0% (See details about stocks)', '0% (See details about stocks)', '0% (See details about stocks)', '0% (See details about stocks)'] },
  { label: 'Order execution',            values: ['Instant', 'Instant', 'Instant', 'Instant'] },
  // Swap is the dedicated swap-free / Sharia-compliant account.
  { label: 'Swap-Free',                  values: ['Optional', 'Optional', 'Optional', 'Always-on'] },
  { label: 'Customer Support',           values: ['24/7', '24/7', '24/7', '24/7'] },
];

function FeatureComparison() {
  return (
    <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pb-24">
      <h2 className="font-display uppercase tracking-tight text-foreground text-3xl sm:text-4xl md:text-5xl text-center mb-12">
        Feature Comparison
      </h2>

      <div className="overflow-x-auto -mx-[var(--gutter)] px-[var(--gutter)]">
        <div className="min-w-[760px] rounded-2xl overflow-hidden border border-foreground/15">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className="w-[220px] bg-foreground/[0.04] border-r border-foreground/15" />
                {COLUMN_HEADERS.map((c, idx) => (
                  <th
                    key={c.name}
                    className={`px-4 py-5 text-center font-display uppercase tracking-[0.16em] text-sm text-white ${idx < COLUMN_HEADERS.length - 1 ? 'border-r border-white/10' : ''}`}
                    style={{ background: c.gradient }}
                  >
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row, i) => (
                <tr key={row.label} className="border-t border-foreground/10">
                  <td className="px-5 py-5 text-sm text-foreground/75 align-middle bg-foreground/[0.04] border-r border-foreground/15">
                    {row.label}
                  </td>
                  {row.values.map((v, j) => (
                    <td
                      key={j}
                      className={`px-4 py-5 text-center text-sm text-foreground/90 align-middle bg-foreground/[0.02] ${j < row.values.length - 1 ? 'border-r border-foreground/10' : ''}`}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
