'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useTradingStore } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';

/**
 * AdvancedChart — embed of TradingView's free public Advanced Chart
 * widget. Used both inside the trading terminal and on the standalone
 * /advanced-chart page.
 *
 * Was the licensed Charting Library (broker integration, custom
 * datafeed, position lines on chart). That stack is removed in favour
 * of the free widget because:
 *   • No license fee or build-side files required.
 *   • All 100+ indicators + drawing tools enabled out of the box.
 *   • Symbol search across global markets without extra plumbing.
 *
 * Trade-offs we accept by switching:
 *   • Chart data is TradingView's public feed (OANDA / FX / BINANCE /
 *     TVC), not the broker's bid/ask. Fills can differ from chart
 *     prices by the broker's spread — this is normal for embed widgets
 *     and clearly disclosed in the trading terminal's price chip.
 *   • No order placement / position lines drawn on the chart. Orders
 *     stay in the OrderPanel; positions in the PositionsPanel below.
 *
 * Symbol resolution: we map the trading store's `selectedSymbol` (e.g.
 * "XAUUSD") through SYMBOL_PREFIX to the widget's full prefixed symbol
 * ("OANDA:XAUUSD"). Anything unmapped falls back to "FX:<sym>" which
 * covers FX majors; if that fails the widget shows a friendly error
 * panel inside its own iframe.
 */

interface TVWidgetCtor {
  new (config: Record<string, unknown>): { remove?: () => void };
}

declare global {
  interface Window {
    TradingView?: { widget?: TVWidgetCtor };
  }
}

// Prefer OANDA for commodities/indices, Binance for crypto, FX: for
// majors. Anything not in this map falls through to FX:.
const SYMBOL_PREFIX: Record<string, string> = {
  // Commodities + spot metals
  XAUUSD: 'OANDA:XAUUSD', XAGUSD: 'OANDA:XAGUSD',
  USOIL: 'TVC:USOIL', UKOIL: 'TVC:UKOIL', NGAS: 'TVC:NATGAS', NATGAS: 'TVC:NATGAS',
  // Indices
  SPX500: 'TVC:SPX', SPX: 'TVC:SPX', US500: 'TVC:SPX',
  NAS100: 'TVC:NDX', NDX: 'TVC:NDX', US100: 'TVC:NDX',
  US30: 'TVC:DJI', DJI: 'TVC:DJI',
  GER30: 'TVC:DEU30', DAX: 'TVC:DEU30', DE40: 'TVC:DEU30',
  UK100: 'TVC:UKX', FTSE: 'TVC:UKX',
  NI225: 'TVC:NI225', JPN225: 'TVC:NI225',
  // Crypto — broker uses USD pairs, TV uses USDT spot on Binance.
  BTCUSD: 'BINANCE:BTCUSDT', BTCUSDT: 'BINANCE:BTCUSDT',
  ETHUSD: 'BINANCE:ETHUSDT', ETHUSDT: 'BINANCE:ETHUSDT',
  BNBUSD: 'BINANCE:BNBUSDT', BNBUSDT: 'BINANCE:BNBUSDT',
  SOLUSD: 'BINANCE:SOLUSDT', SOLUSDT: 'BINANCE:SOLUSDT',
  XRPUSD: 'BINANCE:XRPUSDT', XRPUSDT: 'BINANCE:XRPUSDT',
  ADAUSD: 'BINANCE:ADAUSDT', DOGEUSD: 'BINANCE:DOGEUSDT',
};

function resolveTvSymbol(sym: string | null | undefined): string {
  const s = (sym || '').toUpperCase();
  if (!s) return 'OANDA:XAUUSD';
  if (s.includes(':')) return s; // already a TV-prefixed symbol
  return SYMBOL_PREFIX[s] || `FX:${s}`;
}

// Legacy IANA aliases → canonical names. Some browsers still report
// the pre-rename city ("Asia/Calcutta") and TradingView only honours
// the canonical form ("Asia/Kolkata"), so without this map the clock
// silently falls back to UTC. Confirmed culprit on the user's machine
// 2026-06-01: console returned 'Asia/Calcutta'.
const TZ_ALIAS: Record<string, string> = {
  'Asia/Calcutta':   'Asia/Kolkata',
  'Asia/Saigon':     'Asia/Ho_Chi_Minh',
  'Asia/Katmandu':   'Asia/Kathmandu',
  'Asia/Rangoon':    'Asia/Yangon',
  'Asia/Chongqing':  'Asia/Shanghai',
  'Asia/Harbin':     'Asia/Shanghai',
  'Asia/Macao':      'Asia/Macau',
  'Asia/Dacca':      'Asia/Dhaka',
  'Europe/Kiev':     'Europe/Kyiv',
  'Europe/Nicosia':  'Asia/Nicosia',
  'America/Buenos_Aires':  'America/Argentina/Buenos_Aires',
  'Australia/South':       'Australia/Adelaide',
  'Australia/North':       'Australia/Darwin',
  'Australia/Queensland':  'Australia/Brisbane',
  'Pacific/Ponape':  'Pacific/Pohnpei',
  'Pacific/Truk':    'Pacific/Chuuk',
};

// Curated list for the manual picker — major financial-market hubs +
// India + UAE + auto-detect. Each entry { value: IANA, label: human }.
// User's choice persists in localStorage so it survives reloads.
const TZ_OPTIONS: { value: string; label: string }[] = [
  { value: '__auto', label: 'Auto (your local time)' },
  { value: 'Asia/Kolkata',       label: 'India — Mumbai / Delhi (IST, UTC+5:30)' },
  { value: 'Asia/Dubai',         label: 'UAE — Dubai (GST, UTC+4)' },
  { value: 'Asia/Singapore',     label: 'Singapore (SGT, UTC+8)' },
  { value: 'Asia/Hong_Kong',     label: 'Hong Kong (HKT, UTC+8)' },
  { value: 'Asia/Tokyo',         label: 'Japan — Tokyo (JST, UTC+9)' },
  { value: 'Asia/Shanghai',      label: 'China — Shanghai (CST, UTC+8)' },
  { value: 'Asia/Bangkok',       label: 'Thailand — Bangkok (UTC+7)' },
  { value: 'Asia/Karachi',       label: 'Pakistan — Karachi (UTC+5)' },
  { value: 'Asia/Riyadh',        label: 'Saudi Arabia — Riyadh (UTC+3)' },
  { value: 'Europe/London',      label: 'UK — London (GMT/BST)' },
  { value: 'Europe/Frankfurt',   label: 'Germany — Frankfurt (CET)' },
  { value: 'Europe/Zurich',      label: 'Switzerland — Zurich (CET)' },
  { value: 'Europe/Moscow',      label: 'Russia — Moscow (MSK, UTC+3)' },
  { value: 'America/New_York',   label: 'US East — New York (EST/EDT)' },
  { value: 'America/Chicago',    label: 'US Central — Chicago (CST/CDT)' },
  { value: 'America/Los_Angeles',label: 'US West — Los Angeles (PST/PDT)' },
  { value: 'America/Sao_Paulo',  label: 'Brazil — São Paulo (BRT, UTC-3)' },
  { value: 'Australia/Sydney',   label: 'Australia — Sydney (AEDT)' },
  { value: 'Etc/UTC',            label: 'UTC (universal)' },
];
const TZ_STORAGE_KEY = 'swisdex.chart.tz';

export default function AdvancedChart() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const theme = useUIStore((s) => s.theme);

  const tvSymbol = useMemo(() => resolveTvSymbol(selectedSymbol), [selectedSymbol]);
  const tvTheme: 'dark' | 'light' = theme === 'light' ? 'light' : 'dark';

  // User-picked timezone — '__auto' means follow Intl.DateTimeFormat
  // resolution; any other value is a fixed IANA name. Persists in
  // localStorage so the choice survives reloads.
  const [userTz, setUserTz] = useState<string>('__auto');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(TZ_STORAGE_KEY);
      if (stored) setUserTz(stored);
    } catch { /* private mode — keep default */ }
  }, []);
  const persistTz = (value: string) => {
    setUserTz(value);
    setTzMenuOpen(false);
    try { window.localStorage.setItem(TZ_STORAGE_KEY, value); } catch { /* ignore */ }
  };
  const [tzMenuOpen, setTzMenuOpen] = useState(false);

  // Fullscreen toggle — the embed widget has no fullscreen button of
  // its own, so we drive the browser Fullscreen API on our wrapper.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);
  const toggleFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void el.requestFullscreen().catch(() => {});
    }
  };

  // Re-mount the widget when the resolved symbol or theme changes.
  // The embed script reads its config from the <script> tag content
  // and renders into a sibling div, so the cleanest re-render path
  // is to wipe + re-inject. Same approach used on /advanced-chart.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = '';

    const inner = document.createElement('div');
    inner.className = 'tradingview-widget-container__widget';
    inner.style.height = '100%';
    inner.style.width = '100%';
    container.appendChild(inner);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.type = 'text/javascript';
    // Use the viewer's own timezone so the chart clock matches their
    // wall-clock instead of always showing UTC (the embed widget locks
    // the clock to whatever `timezone` we pass).
    //
    // Fallback chain:
    //   1. Browser's resolved IANA zone, normalized through TZ_ALIAS
    //      so legacy names (Asia/Calcutta, Asia/Saigon, ...) map to
    //      the canonical TradingView expects (Asia/Kolkata, ...).
    //      Client report 2026-06-01: browser returned 'Asia/Calcutta',
    //      widget didn't recognise it, clock stuck on UTC.
    //   2. Asia/Kolkata fallback when the browser hands us a literal
    //      'UTC' / 'Etc/UTC' / 'Etc/GMT'.
    //   3. Etc/UTC as a last resort if anything throws.
    let viewerTz = 'Asia/Kolkata';
    if (userTz && userTz !== '__auto') {
      // User explicitly picked a timezone from the chart picker —
      // honour that over the browser's resolved zone.
      viewerTz = userTz;
    } else {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz && tz !== 'UTC' && tz !== 'Etc/UTC' && tz !== 'Etc/GMT') {
          viewerTz = TZ_ALIAS[tz] || tz;
        }
      } catch { /* keep IST default */ }
    }

    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: '5',
      timezone: viewerTz,
      theme: tvTheme,
      style: '1',                 // candles
      locale: 'en',
      enable_publishing: false,
      // Symbol change LOCKED inside the chart — the widget is a sealed
      // iframe, so a switch made from its own search box never reaches
      // our trading store; the order panel keeps the OLD selection and
      // the next BUY/SELL goes to the wrong instrument. Client report
      // 2026-06-01: "trade me kuch bhi buy/sell kar raha hu, order
      // gold pe hi lag raha hai" while the chart was on BTCUSD. The
      // order panel's MARKETS button is now the only symbol picker —
      // it updates the store, chart re-renders via tvSymbol prop, and
      // every order goes to the same symbol the user is looking at.
      allow_symbol_change: false,
      hide_side_toolbar: false,   // expose drawing tools
      withdateranges: true,
      hide_volume: false,
      details: false,
      studies: [],
      support_host: 'https://www.tradingview.com',
    });
    container.appendChild(script);

    return () => {
      try { container.innerHTML = ''; } catch { /* noop */ }
    };
  }, [tvSymbol, tvTheme, userTz]);

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-full min-h-[200px] min-w-0 bg-bg-base"
    >
      {/* SwisDex branding lives on the page-level sidebar/header above
          this chart already — adding another logo here just duplicated.
          The chart now ships with only the fullscreen toggle, sized to
          stay clear of TradingView's instrument-name watermark
          (top-left) and the right-edge controls. */}

      {/* Timezone picker — click to open dropdown of common timezones.
          Selection persists in localStorage and forces the widget to
          rebuild (useEffect deps include userTz). Shows the active
          zone label so the user always knows what timezone the chart
          clock is in. Client report 2026-06-01: "us par click karunga
          to multiple options dikhenge?". */}
      <div className="absolute top-2 right-12 z-20">
        <button
          type="button"
          onClick={() => setTzMenuOpen((v) => !v)}
          title="Change chart timezone"
          className="px-2 py-1.5 rounded-md bg-black/40 hover:bg-black/60 text-white/80 hover:text-white backdrop-blur-sm transition-colors text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
        >
          <span>🕐</span>
          <span className="hidden sm:inline">
            {userTz === '__auto'
              ? 'Auto'
              : (TZ_OPTIONS.find((o) => o.value === userTz)?.label.split(' — ')[0] || userTz.split('/').pop())}
          </span>
        </button>
        {tzMenuOpen && (
          <>
            {/* Click-away catcher */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setTzMenuOpen(false)}
            />
            <div className="absolute right-0 mt-1 z-20 w-72 max-h-80 overflow-y-auto rounded-md bg-bg-secondary border border-border-primary shadow-xl">
              {TZ_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => persistTz(opt.value)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-bg-hover border-b border-border-primary/40 last:border-0 ${
                    userTz === opt.value ? 'text-accent font-semibold' : 'text-text-secondary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={toggleFullscreen}
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        className="absolute top-2 right-2 z-20 p-1.5 rounded-md bg-black/40 hover:bg-black/60 text-white/80 hover:text-white backdrop-blur-sm transition-colors"
      >
        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>

      <div
        ref={containerRef}
        className="tradingview-widget-container w-full h-full min-h-[200px] min-w-0"
        data-tv-chart-root
      />
    </div>
  );
}
