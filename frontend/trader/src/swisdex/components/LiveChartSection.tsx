'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Repeat, Coins, Bitcoin, BarChart3 } from 'lucide-react';
import { TradingViewChart } from './TradingViewChart';

interface QuickTab {
  key: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  symbol: string;
  tvSymbol: string;
  spread: string;
}

const QUICK_TABS: QuickTab[] = [
  { key: 'forex',   label: 'Forex',   Icon: Repeat,    symbol: 'EUR/USD', tvSymbol: 'FX:EURUSD',       spread: '0.1 pips' },
  { key: 'gold',    label: 'Gold',    Icon: Coins,     symbol: 'XAU/USD', tvSymbol: 'OANDA:XAUUSD',    spread: '0.15 pips' },
  { key: 'crypto',  label: 'Crypto',  Icon: Bitcoin,   symbol: 'BTC/USD', tvSymbol: 'BINANCE:BTCUSDT', spread: '$2.50' },
  { key: 'indices', label: 'Indices', Icon: BarChart3, symbol: 'US30',    tvSymbol: 'OANDA:US30USD',   spread: '1.0 pts' },
];

/* TradingView symbol mapping for every directory item below. */
const INSTRUMENT_MAP: Record<string, string> = {
  // Indices
  'SMI':              'TVC:SMI',
  'US_500':           'OANDA:SPX500USD',
  'CANNABIS INDEX':   'AMEX:MJ',
  'US_TECH100':       'OANDA:NAS100USD',
  'US_30':            'OANDA:US30USD',
  'US_2000':          'OANDA:US2000USD',
  'DOLLAR INDEX':     'TVC:DXY',
  'SPAIN 35':         'OANDA:ESP35EUR',
  // Commodities
  'Crude Oil':        'TVC:USOIL',
  'Copper':           'OANDA:XCUUSD',
  'Brent Oil':        'TVC:UKOIL',
  'Heating Oil':      'NYMEX:HO1!',
  'Gasoline':         'NYMEX:RB1!',
  'Natural Gas':      'TVC:NATGAS',
  'Gold Trading':     'OANDA:XAUUSD',
  'Silver':           'OANDA:XAGUSD',
  'Wheat':            'CBOT:ZW1!',
  'Corn':             'CBOT:ZC1!',
  // Stocks
  'Apple':            'NASDAQ:AAPL',
  'Amazon':           'NASDAQ:AMZN',
  'Microsoft':        'NASDAQ:MSFT',
  'Netflix':          'NASDAQ:NFLX',
  'Pfizer':           'NYSE:PFE',
  'Adobe':            'NASDAQ:ADBE',
  'Alibaba':          'NYSE:BABA',
  'Intel':            'NASDAQ:INTC',
  'Teva':             'NYSE:TEVA',
  'American Express': 'NYSE:AXP',
  // Forex pairs
  'EUR/USD':          'FX:EURUSD',
  'GBP/USD':          'FX:GBPUSD',
  'USD/JPY':          'FX:USDJPY',
  'AUD/USD':          'FX:AUDUSD',
  'EUR/GBP':          'FX:EURGBP',
  'USD/CAD':          'FX:USDCAD',
  'USD/CHF':          'FX:USDCHF',
  'GBP/JPY':          'FX:GBPJPY',
  'EUR/CAD':          'FX:EURCAD',
  'EUR/AUD':          'FX:EURAUD',
  'AUD/CHF':          'FX:AUDCHF',
  // Options (forex options → underlying spot pair)
  'AUD/CAD Options':  'FX:AUDCAD',
  'AUD/CHF Options':  'FX:AUDCHF',
  'AUD/JPY Options':  'FX:AUDJPY',
  'AUD/NZD Options':  'FX:AUDNZD',
  'AUD/USD Options':  'FX:AUDUSD',
  'CAD/CHF Options':  'FX:CADCHF',
  'CAD/JPY Options':  'FX:CADJPY',
  'CHF/JPY Options':  'FX:CHFJPY',
};

interface Column {
  heading: string;
  viewAllHref: string;
  items: string[];
}

const COLUMNS: Column[] = [
  {
    heading: 'Indices',
    viewAllHref: '/trading/indices',
    items: ['SMI', 'US_500', 'CANNABIS INDEX', 'US_TECH100', 'US_30', 'US_2000', 'DOLLAR INDEX', 'SPAIN 35'],
  },
  {
    heading: 'Commodities',
    viewAllHref: '/trading/commodities',
    items: ['Crude Oil', 'Copper', 'Brent Oil', 'Heating Oil', 'Gasoline', 'Natural Gas', 'Gold Trading', 'Silver', 'Wheat', 'Corn'],
  },
  {
    heading: 'Stocks',
    viewAllHref: '/markets',
    items: ['Apple', 'Amazon', 'Microsoft', 'Netflix', 'Pfizer', 'Adobe', 'Alibaba', 'Intel', 'Teva', 'American Express'],
  },
  {
    heading: 'Forex Pairs',
    viewAllHref: '/trading/forex',
    items: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'EUR/GBP', 'USD/CAD', 'USD/CHF', 'GBP/JPY', 'EUR/CAD', 'EUR/AUD', 'AUD/CHF'],
  },
  {
    heading: 'Options',
    viewAllHref: '/markets',
    items: ['AUD/CAD Options', 'AUD/CHF Options', 'AUD/JPY Options', 'AUD/NZD Options', 'AUD/USD Options', 'CAD/CHF Options', 'CAD/JPY Options', 'CHF/JPY Options'],
  },
];

export function LiveChartSection() {
  // Active chart state — populated from quick-tabs or instrument directory.
  const [activeSymbol, setActiveSymbol] = useState<string>(QUICK_TABS[0].symbol);
  const [activeTv,     setActiveTv]     = useState<string>(QUICK_TABS[0].tvSymbol);
  const [activeSpread, setActiveSpread] = useState<string>(QUICK_TABS[0].spread);
  const chartRef = useRef<HTMLDivElement>(null);

  const selectInstrument = (label: string) => {
    const tv = INSTRUMENT_MAP[label];
    if (!tv) return;
    setActiveSymbol(label);
    setActiveTv(tv);
    setActiveSpread('Market');
    // Smooth-scroll to the chart card after a short delay so the user sees the update.
    requestAnimationFrame(() => {
      chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const selectQuickTab = (t: QuickTab) => {
    setActiveSymbol(t.symbol);
    setActiveTv(t.tvSymbol);
    setActiveSpread(t.spread);
  };

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
          Pick any instrument below — the live chart updates instantly. Professional-grade charts. Zero delay. Always on.
        </p>

        {/* Instrument directory (now ABOVE the chart) */}
        <InstrumentDirectory
          activeLabel={activeSymbol}
          onSelect={selectInstrument}
        />

        {/* Quick-tabs for popular asset classes */}
        <div className="mt-12 inline-flex flex-wrap justify-center gap-2 p-1.5 rounded-full liquid-glass">
          {QUICK_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => selectQuickTab(t)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-body transition-colors ${
                activeSymbol === t.symbol ? 'bg-primary text-white' : 'text-foreground/70 hover:text-foreground'
              }`}
            >
              <t.Icon className="size-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Live chart card */}
        <div ref={chartRef} className="mt-10 scroll-mt-32">
          <Link
            href="/trading/terminal"
            className="block rounded-3xl p-4 sm:p-8 text-left group transition-transform hover:scale-[1.005]"
            aria-label={`Open ${activeSymbol} on the trading terminal`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="font-display text-2xl sm:text-3xl text-foreground">{activeSymbol}</span>
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-primary/25 text-primary font-body">
                  <span className="relative inline-flex items-center justify-center">
                    <span className="absolute size-1.5 rounded-full bg-primary opacity-75 animate-ping" />
                    <span className="relative size-1.5 rounded-full bg-primary" />
                  </span>
                  LIVE
                </span>
              </div>
              <div className="text-xs text-foreground/55 hidden sm:block">Spread from {activeSpread}</div>
            </div>

            <div className="aspect-[16/8] sm:aspect-[16/7] rounded-2xl overflow-hidden">
              <TradingViewChart symbol={activeTv} />
            </div>

            <div className="mt-4 flex items-center justify-end text-xs text-foreground/55 group-hover:text-primary transition-colors">
              Open in Terminal <ArrowUpRight className="ml-1 size-3.5" />
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Instrument directory — 5 columns of clickable symbols.
   ───────────────────────────────────────────────────────────────────── */

function InstrumentDirectory({
  activeLabel,
  onSelect,
}: {
  activeLabel: string;
  onSelect: (label: string) => void;
}) {
  return (
    <div className="mt-12 sm:mt-16 text-left">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-10">
        {COLUMNS.map((col) => (
          <div key={col.heading}>
            <h3 className="font-display uppercase text-lg sm:text-xl tracking-tight text-foreground mb-4">
              {col.heading}
            </h3>
            <ul className="flex flex-col gap-2.5">
              {col.items.map((item) => {
                const isActive = activeLabel === item;
                return (
                  <li key={item}>
                    <button
                      type="button"
                      onClick={() => onSelect(item)}
                      className={`text-left text-base transition-colors ${
                        isActive
                          ? 'text-primary font-semibold'
                          : 'text-foreground/75 hover:text-primary'
                      }`}
                      aria-pressed={isActive}
                      aria-label={`Load ${item} live chart`}
                    >
                      {item}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
