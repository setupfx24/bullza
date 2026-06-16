'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import { TradingViewChart } from './TradingViewChart';

/** Initial chart state — first instrument loaded into the live chart on mount. */
const DEFAULT_SYMBOL   = 'US30';
const DEFAULT_TV       = 'OANDA:US30USD';

/* TradingView symbol mapping for every directory item below. */
const INSTRUMENT_MAP: Record<string, string> = {
  // Indices
  'SMI':              'BLACKBULL:SMI20',
  'US_500':           'OANDA:SPX500USD',
  'CANNABIS INDEX':   'AMEX:MJ',
  'US_TECH100':       'OANDA:NAS100USD',
  'US_30':            'OANDA:US30USD',
  'US_2000':          'OANDA:US2000USD',
  'DOLLAR INDEX':     'CAPITALCOM:DXY',
  'SPAIN 35':         'OANDA:ESP35EUR',
  // Commodities
  'Crude Oil':        'OANDA:WTICOUSD',
  'Copper':           'OANDA:XCUUSD',
  'Brent Oil':        'OANDA:BCOUSD',
  'Heating Oil':      'NYMEX:HO1!',
  'Gasoline':         'NYMEX:RB1!',
  'Natural Gas':      'BLACKBULL:NGAS',
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
];

export function LiveChartSection() {
  // Active chart state — populated by clicking an item in the instrument directory.
  const [activeSymbol, setActiveSymbol] = useState<string>(DEFAULT_SYMBOL);
  const [activeTv,     setActiveTv]     = useState<string>(DEFAULT_TV);
  const chartRef = useRef<HTMLDivElement>(null);

  const selectInstrument = (label: string) => {
    const tv = INSTRUMENT_MAP[label];
    if (!tv) return;
    setActiveSymbol(label);
    setActiveTv(tv);
    // Smooth-scroll to the chart card after a short delay so the user sees the update.
    requestAnimationFrame(() => {
      chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
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
  // Track which category dropdown is open. -1 means all collapsed.
  const [openIdx, setOpenIdx] = useState<number>(-1);
  const closeTimer = useRef<number | null>(null);

  /** Cancel any pending close (called when re-entering the dropdown area). */
  const cancelClose = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  /** Schedule a close — small delay so the user can move from the button to
   *  the floating panel without it disappearing. */
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpenIdx(-1), 180);
  };

  return (
    <div className="mt-12 sm:mt-16 text-left">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display uppercase text-base sm:text-lg tracking-[0.18em] text-foreground/55">
          Browse Instruments
        </h3>
        <span className="hidden sm:inline-flex items-center text-[11px] uppercase tracking-[0.16em] text-foreground/40 gap-1">
          Hover or tap to expand
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 items-start">
        {COLUMNS.map((col, i) => {
          const isOpen = openIdx === i;
          return (
            <div
              key={col.heading}
              className="flex flex-col"
              /* Pointer-aware hover: mouse only. Touch devices skip these
                 so the click handler isn't fighting a phantom hover that
                 mobile browsers emulate on tap (which caused the dropdown
                 to open then instantly close). */
              onPointerEnter={(e) => {
                if (e.pointerType !== 'mouse') return;
                cancelClose();
                setOpenIdx(i);
              }}
              onPointerLeave={(e) => {
                if (e.pointerType !== 'mouse') return;
                scheduleClose();
              }}
            >
              {/* Category trigger */}
              <button
                type="button"
                onClick={(e) => {
                  const next = openIdx === i ? -1 : i;
                  setOpenIdx(next);
                  // On mobile, scroll the newly-opened panel into view so the
                  // user doesn't have to hunt for it after tapping.
                  if (next !== -1) {
                    const btn = e.currentTarget;
                    requestAnimationFrame(() => {
                      btn.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    });
                  }
                }}
                aria-expanded={isOpen}
                aria-haspopup="true"
                aria-label={`Show ${col.heading} instruments`}
                /* Chrome/Edge form-helper extensions inject `fdprocessedid`
                   onto these buttons after first paint, which triggers a
                   React hydration-mismatch warning. The button is
                   functionally unaffected — suppress the warning. */
                suppressHydrationWarning
                className={`w-full liquid-glass rounded-2xl px-4 py-4 flex items-center justify-between gap-2 transition-colors ${
                  isOpen ? 'bg-primary/10 ring-1 ring-primary/40' : 'hover:bg-foreground/[0.05]'
                }`}
              >
                <span
                  className="font-display uppercase text-sm sm:text-base tracking-tight"
                  style={{ color: '#ffffff' }}
                >
                  {col.heading}
                </span>
                <ChevronDown
                  className={`size-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  style={{ color: isOpen ? '#F04024' : 'rgba(255,255,255,0.85)' }}
                  aria-hidden
                />
              </button>

              {/* Inline dropdown — appears directly below the button in the
                  normal document flow. Pushes the chart down rather than
                  overlaying it. Per client request: items render right
                  underneath the category card, no floating panel. */}
              {isOpen && (
                <div
                  className="mt-2 liquid-glass-strong rounded-2xl p-3 [backdrop-filter:blur(28px)]"
                  style={{ border: '1px solid hsl(8 87% 54% / 0.35)' }}
                  role="menu"
                >
                  <ul className="flex flex-col gap-1 max-h-[320px] overflow-y-auto">
                    {col.items.map((item) => {
                      const isActive = activeLabel === item;
                      return (
                        <li key={item} role="none">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              onSelect(item);
                              setOpenIdx(-1);
                            }}
                            className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                              isActive
                                ? 'bg-primary/25 font-semibold'
                                : 'hover:bg-foreground/[0.08]'
                            }`}
                            style={{ color: isActive ? '#F04024' : '#ffffff' }}
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
