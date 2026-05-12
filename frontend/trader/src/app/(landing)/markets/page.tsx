'use client';

import Link from 'next/link';
import { ArrowUpRight, Repeat, BarChart3, Coins, Bitcoin, LineChart } from 'lucide-react';
import { LiveChartSection } from '@/swisdex/components/LiveChartSection';

const MARKETS = [
  { title: 'Forex',       href: '/trading/forex',       Icon: Repeat,    blurb: 'Trade 60+ currency pairs — majors, minors, exotics. Tight spreads, deep liquidity, 24/7.' },
  { title: 'Indices',     href: '/trading/indices',     Icon: BarChart3, blurb: "Get exposure to the world's top economies through US, European, and Asian stock indices." },
  { title: 'Commodities', href: '/trading/commodities', Icon: Coins,     blurb: 'Trade Gold, Silver, Crude Oil, and Natural Gas with real-time pricing and institutional execution.' },
  { title: 'Crypto',      href: '/trading/crypto',      Icon: Bitcoin,   blurb: 'Trade Bitcoin, Ethereum, and top digital assets around the clock with fast, transparent pricing.' },
  { title: 'Stocks',      href: '/auth/register',       Icon: LineChart, blurb: 'Access global equities from major exchanges with margin flexibility and competitive conditions.' },
];

export default function MarketsPage() {
  return (
    <main className="relative min-h-screen bg-background overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 0%, hsl(99 55% 42% / 0.18), transparent 70%)' }}
      />

      {/* Live chart + instrument directory — moved to top of page */}
      <div className="pt-24 sm:pt-28 md:pt-32">
        <LiveChartSection />
      </div>

      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pt-4 pb-12 sm:pb-20 md:pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full liquid-glass text-xs uppercase tracking-[0.18em] text-foreground/70 font-body">
          <span className="size-1.5 rounded-full bg-primary" />
          What You Can Trade
        </div>
        <h2 className="mt-6 font-display uppercase tracking-tight leading-[0.95] text-foreground text-3xl sm:text-5xl md:text-6xl lg:text-7xl break-words">
          One Account.
          <br />
          <span className="text-primary">Every Market.</span>
        </h2>
        <p className="mt-7 mx-auto max-w-2xl text-foreground/70 text-base sm:text-lg leading-relaxed">
          SwisDex gives you direct access to the world's most traded financial instruments —
          all from a single, unified account.
        </p>
      </section>

      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pb-24">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {MARKETS.map(({ title, href, Icon, blurb }) => (
            <Link
              key={title}
              href={href}
              className="liquid-glass rounded-2xl p-7 group transition-transform hover:scale-[1.02]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="size-12 rounded-xl bg-primary/25 flex items-center justify-center">
                  <Icon className="size-6 text-primary" />
                </div>
                <ArrowUpRight className="size-5 text-foreground/40 group-hover:text-primary transition-colors" />
              </div>
              <h3 className="mt-5 font-display text-2xl uppercase tracking-tight text-foreground">{title}</h3>
              <p className="mt-3 text-sm text-foreground/65 leading-relaxed">{blurb}</p>
            </Link>
          ))}
        </div>

        <div className="mt-14 text-center">
          <Link
            href="/auth/register"
            className="inline-flex items-center gap-2 rounded-full bg-primary text-white px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity"
          >
            Open Account <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
