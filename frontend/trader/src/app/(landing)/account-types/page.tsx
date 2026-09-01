'use client';

/**
 * Account Types — account SPECIFICATION cards, not pricing plans.
 * Per client requirement there is no pricing/plans section anywhere on the
 * site: these cards describe the trading conditions of each real account
 * type (minimum deposit, spread, commission, leverage, swap treatment) and
 * every CTA opens an account rather than starting a checkout.
 * Restyled onto the shared marketing design system; copy carried over.
 */
import Link from 'next/link';
import { CheckCircle2, ArrowUpRight } from 'lucide-react';
import { Section, SectionHeading, PageHero, CtaBanner } from '@/marketing/components';
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

const INSTRUMENTS = ['Forex', 'Metal', 'Crypto', 'Energies', 'Stocks', 'Indices'];

const COLUMN_HEADERS = ['Standard', 'ECN', 'IB', 'Swap'];

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
          <span
            key={inst}
            className="px-2.5 py-0.5"
            style={{
              fontSize: 'var(--mk-text-xs)',
              borderRadius: 'var(--mk-radius-pill)',
              border: '1px solid var(--mk-line)',
              background: 'var(--mk-surface-2)',
              color: 'var(--mk-text-muted)',
            }}
          >
            {inst}
          </span>
        ))}
      </div>
    )),
  },
  { label: 'Minimum lot size',            values: ['0.01', '0.01', '0.01', '0.01'] },
  { label: 'Maximum Number of positions', values: ['Unlimited', 'Unlimited', 'Unlimited', 'Unlimited'] },
  { label: 'Hedged Margin',               values: ['0%', '0%', '0%', '0%'] },
  { label: 'Margin call',                 values: ['30%', '30%', '30%', '30%'] },
  { label: 'Stop out',                    values: ['0% (See details about stocks)', '0% (See details about stocks)', '0% (See details about stocks)', '0% (See details about stocks)'] },
  { label: 'Order execution',             values: ['Instant', 'Instant', 'Instant', 'Instant'] },
  // Swap is the dedicated swap-free / Sharia-compliant account.
  { label: 'Swap-Free',                   values: ['Optional', 'Optional', 'Optional', 'Always-on'] },
  { label: 'Customer Support',            values: ['24/7', '24/7', '24/7', '24/7'] },
];

export default function AccountTypesPage() {
  return (
    <main>
      <PageHero
        kicker="Find Your Fit"
        title={<>Accounts Designed<br /><span style={{ color: 'var(--mk-accent)' }}>Around You</span></>}
        lead={`From your first trade to your ten-thousandth — ${BRAND_NAME} has an account built for your level.`}
        primary={{ label: 'Open Account', href: '/auth/register' }}
      />

      <Section raised>
        <SectionHeading
          kicker="Account Specifications"
          title="Trading Conditions by Account Type"
          lead="Same platform, same execution — different trading conditions. Review the specifications and open the account that matches how you trade."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
          {TIERS.map((t) => (
            <article
              key={t.name}
              className="mk-card mk-card--hover flex flex-col gap-4"
              style={t.highlight ? { borderColor: 'var(--mk-accent-line)' } : undefined}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="mk-h3">{t.name}</h3>
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 font-bold uppercase"
                  style={{
                    fontSize: '10px',
                    letterSpacing: '0.12em',
                    background: t.highlight ? 'var(--mk-accent)' : 'var(--mk-accent-soft)',
                    color: t.highlight ? '#fff' : 'var(--mk-accent)',
                  }}
                >
                  {t.badge}
                </span>
              </div>

              {/* Specification rows — deliberately a spec sheet, not a price tag. */}
              <dl
                className="flex flex-col gap-2 py-3"
                style={{ borderTop: '1px solid var(--mk-line)', borderBottom: '1px solid var(--mk-line)' }}
              >
                {[
                  ['Minimum deposit', t.deposit],
                  ['Spread', t.spread],
                  ['Commission', t.commission],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3">
                    <dt
                      style={{
                        fontSize: 'var(--mk-text-label)',
                        letterSpacing: 'var(--mk-tracking-label)',
                        textTransform: 'uppercase',
                        color: 'var(--mk-text-faint)',
                      }}
                    >
                      {k}
                    </dt>
                    <dd className="text-right font-semibold" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text)' }}>
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{t.desc}</p>

              <ul className="flex flex-col gap-2 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
                    <CheckCircle2 size={15} className="mt-1 shrink-0" style={{ color: 'var(--mk-accent)' }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-2">
                <Link href="/auth/register" className="mk-btn mk-btn--primary w-full">
                  Open account
                </Link>
                <Link href={t.href} className="mk-btn mk-btn--ghost w-full">
                  Learn More <ArrowUpRight size={15} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading kicker="Specifications" title="Feature Comparison" />

        <div className="mt-12 overflow-x-auto">
          <div
            className="min-w-[760px] overflow-hidden"
            style={{ border: '1px solid var(--mk-line)', borderRadius: 'var(--mk-radius-lg)' }}
          >
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className="w-[220px]" style={{ background: 'var(--mk-surface-2)', borderRight: '1px solid var(--mk-line)' }} />
                  {COLUMN_HEADERS.map((name) => (
                    <th
                      key={name}
                      className="px-4 py-5 text-center"
                      style={{
                        background: 'var(--mk-surface-2)',
                        color: 'var(--mk-accent)',
                        fontSize: 'var(--mk-text-label)',
                        letterSpacing: 'var(--mk-tracking-label)',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        borderRight: '1px solid var(--mk-line)',
                      }}
                    >
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_ROWS.map((row) => (
                  <tr key={row.label} style={{ borderTop: '1px solid var(--mk-line)' }}>
                    <td
                      className="px-5 py-5 align-middle"
                      style={{
                        fontSize: 'var(--mk-text-sm)',
                        color: 'var(--mk-text-muted)',
                        background: 'var(--mk-surface-2)',
                        borderRight: '1px solid var(--mk-line)',
                      }}
                    >
                      {row.label}
                    </td>
                    {row.values.map((v, j) => (
                      <td
                        key={j}
                        className="px-4 py-5 text-center align-middle"
                        style={{
                          fontSize: 'var(--mk-text-sm)',
                          color: 'var(--mk-text)',
                          background: 'var(--mk-surface)',
                          borderRight: j < row.values.length - 1 ? '1px solid var(--mk-line)' : undefined,
                        }}
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
      </Section>

      <CtaBanner
        title="Open the account that fits how you trade"
        lead={`Every ${BRAND_NAME} account runs on the same platform and the same execution — pick the conditions that suit you and get started.`}
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Try a Demo Account', href: '/accounts/demo' }}
      />
    </main>
  );
}
