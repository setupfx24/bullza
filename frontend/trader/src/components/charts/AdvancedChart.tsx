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

export default function AdvancedChart() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const theme = useUIStore((s) => s.theme);

  const tvSymbol = useMemo(() => resolveTvSymbol(selectedSymbol), [selectedSymbol]);
  const tvTheme: 'dark' | 'light' = theme === 'light' ? 'light' : 'dark';

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
    // wall-clock instead of always showing UTC (client couldn't change
    // it — the embed widget locks the clock to whatever `timezone` we
    // pass). Falls back to UTC if the browser doesn't resolve one.
    let viewerTz = 'Etc/UTC';
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) viewerTz = tz;
    } catch { /* keep UTC */ }

    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: '5',
      timezone: viewerTz,
      theme: tvTheme,
      style: '1',                 // candles
      locale: 'en',
      enable_publishing: false,
      // Allow the trader to flip symbol from inside the chart toolbar —
      // they're not bound to the order panel's selection here.
      allow_symbol_change: true,
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
  }, [tvSymbol, tvTheme]);

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-full min-h-[200px] min-w-0 bg-bg-base flex flex-col"
    >
      {/* SwisDex brand strip — sits ABOVE the TradingView iframe so it
          can't overlap the instrument-name watermark or the fullscreen
          button. Always visible without scrolling, ~28px tall so it
          doesn't eat meaningful chart real estate. */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-primary/60 bg-bg-secondary/40 shrink-0">
        <img
          src="/images/swisdex_png5.png"
          alt="SwisDex"
          className="h-4 sm:h-5 w-auto opacity-90 select-none drop-shadow"
        />
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      <div
        ref={containerRef}
        className="tradingview-widget-container w-full flex-1 min-h-0 min-w-0"
        data-tv-chart-root
      />
    </div>
  );
}
