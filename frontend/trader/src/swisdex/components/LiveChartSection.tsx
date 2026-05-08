'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Repeat, Coins, Bitcoin, BarChart3 } from 'lucide-react';
import { TradingViewChart } from './TradingViewChart';

type ChartTab = {
  key: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  symbol: string;
  tvSymbol: string;
  spread: string;
};

const CHART_TABS: ChartTab[] = [
  { key: 'forex',   label: 'Forex',   Icon: Repeat,    symbol: 'EUR/USD', tvSymbol: 'FX:EURUSD',       spread: '0.1 pips' },
  { key: 'gold',    label: 'Gold',    Icon: Coins,     symbol: 'XAU/USD', tvSymbol: 'OANDA:XAUUSD',    spread: '0.15 pips' },
  { key: 'crypto',  label: 'Crypto',  Icon: Bitcoin,   symbol: 'BTC/USD', tvSymbol: 'BINANCE:BTCUSDT', spread: '$2.50' },
  { key: 'indices', label: 'Indices', Icon: BarChart3, symbol: 'US30',    tvSymbol: 'OANDA:US30USD',   spread: '1.0 pts' },
];

export function LiveChartSection() {
  const [active, setActive] = useState(CHART_TABS[0].key);
  const current = CHART_TABS.find((t) => t.key === active)!;

  return (
    <section className="relative py-20 sm:py-28 bg-background">
      <div className="mx-auto max-w-[1200px] px-[var(--gutter)] text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full liquid-glass text-xs uppercase tracking-[0.18em] text-foreground/70 font-body">
          <span className="size-1.5 rounded-full bg-primary" />
          Real-Time Data
        </div>
        <h2 className="mt-5 font-display uppercase text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight leading-[0.95] text-foreground">
          Markets at Your Fingertips
        </h2>
        <p className="mt-5 text-foreground/65 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed">
          Monitor live price action across all asset classes. Professional-grade charts. Zero delay. Always on.
        </p>

        <div className="mt-10 inline-flex flex-wrap justify-center gap-2 p-1.5 rounded-full liquid-glass">
          {CHART_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-body transition-colors ${
                active === t.key ? 'bg-primary text-white' : 'text-foreground/70 hover:text-foreground'
              }`}
            >
              <t.Icon className="size-4" />
              {t.label}
            </button>
          ))}
        </div>

        <Link
          href="/trading/terminal"
          className="mt-10 block rounded-3xl p-4 sm:p-8 text-left group transition-transform hover:scale-[1.005]"
          aria-label={`Open ${current.symbol} on the trading terminal`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="font-display text-2xl sm:text-3xl text-foreground">{current.symbol}</span>
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-primary/25 text-primary font-body">
                <span className="relative inline-flex items-center justify-center">
                  <span className="absolute size-1.5 rounded-full bg-primary opacity-75 animate-ping" />
                  <span className="relative size-1.5 rounded-full bg-primary" />
                </span>
                LIVE
              </span>
            </div>
            <div className="text-xs text-foreground/55 hidden sm:block">Spread from {current.spread}</div>
          </div>

          <div className="aspect-[16/8] sm:aspect-[16/7] rounded-2xl overflow-hidden">
            <TradingViewChart symbol={current.tvSymbol} />
          </div>

          <div className="mt-4 flex items-center justify-end text-xs text-foreground/55 group-hover:text-primary transition-colors">
            Open in Terminal <ArrowUpRight className="ml-1 size-3.5" />
          </div>
        </Link>
      </div>
    </section>
  );
}
