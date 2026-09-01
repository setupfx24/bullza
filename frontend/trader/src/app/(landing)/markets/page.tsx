'use client';

import Link from 'next/link';
import { ArrowUpRight, Repeat, BarChart3, Coins, Bitcoin, LineChart } from 'lucide-react';
import { LiveChartSection } from '@/home/components/LiveChartSection';
import { Section, SectionHeading, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

const MARKETS = [
  { title: 'Forex',       href: '/trading/forex',       Icon: Repeat,    blurb: 'Trade 60+ currency pairs — majors, minors, exotics. Tight spreads, deep liquidity, 24/7.' },
  { title: 'Indices',     href: '/trading/indices',     Icon: BarChart3, blurb: "Get exposure to the world's top economies through US, European, and Asian stock indices." },
  { title: 'Commodities', href: '/trading/commodities', Icon: Coins,     blurb: 'Trade Gold, Silver, Crude Oil, and Natural Gas with real-time pricing and institutional execution.' },
  { title: 'Crypto',      href: '/trading/crypto',      Icon: Bitcoin,   blurb: 'Trade Bitcoin, Ethereum, and top digital assets around the clock with fast, transparent pricing.' },
  { title: 'Stocks',      href: '/auth/register',       Icon: LineChart, blurb: 'Access global equities from major exchanges with margin flexibility and competitive conditions.' },
];

export default function MarketsPage() {
  return (
    <main>
      {/* Live chart + instrument directory — kept at the top of the page */}
      <div style={{ paddingTop: 'var(--mk-space-9)' }}>
        <LiveChartSection />
      </div>

      <Section raised>
        <SectionHeading
          kicker="What You Can Trade"
          title={<>One Login. <span style={{ color: 'var(--mk-accent)' }}>Every Market.</span></>}
          lead={`${BRAND_NAME} gives you direct access to the world's most traded financial instruments — from a single ${BRAND_NAME} login. Open Standard, ECN, Pro, IB, or Demo accounts as you need them.`}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
          {MARKETS.map(({ title, href, Icon, blurb }) => (
            <Link key={title} href={href} className="mk-card mk-card--hover group flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <span
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
                  style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
                >
                  <Icon size={20} />
                </span>
                <ArrowUpRight
                  size={18}
                  className="shrink-0 transition-colors"
                  style={{ color: 'var(--mk-text-faint)' }}
                />
              </div>
              <h3 className="mk-h3">{title}</h3>
              <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{blurb}</p>
            </Link>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link href="/auth/register" className="mk-btn mk-btn--primary">
            Open Account <ArrowUpRight size={16} />
          </Link>
        </div>
      </Section>

      <CtaBanner
        title="One Account. Every Market."
        lead={`Open a ${BRAND_NAME} account and trade forex, indices, commodities, crypto, and global equities from a single login.`}
        primary={{ label: 'Open Account', href: '/auth/register' }}
        secondary={{ label: 'Compare Account Types', href: '/account-types' }}
      />
    </main>
  );
}
