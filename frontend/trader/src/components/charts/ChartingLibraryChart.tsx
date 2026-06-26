'use client';

/**
 * Full TradingView Charting Library chart — pro UI fed by OUR engine data so the
 * candles match the running P&L (unlike the Advanced Chart WIDGET, which streams
 * TradingView's public OANDA feed). Wires the licensed library in
 * `public/charting_library/` to `swisDexDatafeed` (history = gateway
 * /instruments/{sym}/bars from the InfoWay BarAggregator; live = /ws/bars).
 *
 * Also draws a BUY/SELL position line on the chart for each open trade on the
 * current symbol (entry price + side + live P&L), updated as positions change.
 *
 * Revert to '@/components/charts/AdvancedChart' for the public widget.
 */
import { useEffect, useRef, useState } from 'react';
import { useTradingStore } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';
import { swisDexDatafeed } from '@/lib/charting/datafeed';

// The licensed library attaches `TradingView` to window once the script runs.
// Use `any` for the widget/chart — the bundled .d.ts is huge and we only touch
// a few methods, each guarded by try/catch.
type TVWidget = { onChartReady?: (cb: () => void) => void; activeChart?: () => any; remove?: () => void };
declare global {
  interface Window { TradingView?: { widget?: new (opts: Record<string, unknown>) => TVWidget } }
}

let _libPromise: Promise<void> | null = null;
function loadChartingLibrary(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.TradingView?.widget) return Promise.resolve();
  if (_libPromise) return _libPromise;
  _libPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/charting_library/charting_library.standalone.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { _libPromise = null; reject(new Error('charting_library failed to load')); };
    document.head.appendChild(s);
  });
  return _libPromise;
}

export default function ChartingLibraryChart() {
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const positions = useTradingStore((s) => s.positions);
  const theme = useUIStore((s) => s.theme);

  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<TVWidget | null>(null);
  // Map position id -> chart position-line object, so we update/remove in place.
  const linesRef = useRef<Map<string, any>>(new Map());
  const [ready, setReady] = useState(false);

  // Create / recreate the widget when the symbol or theme changes.
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    linesRef.current.clear();

    loadChartingLibrary().then(() => {
      if (cancelled || !containerRef.current || !window.TradingView?.widget) return;
      try { widgetRef.current?.remove?.(); } catch { /* noop */ }
      const w = new window.TradingView.widget({
        symbol: selectedSymbol || 'XAUUSD',
        interval: '5',
        container: containerRef.current,
        datafeed: swisDexDatafeed,
        library_path: '/charting_library/',
        locale: 'en',
        theme: theme === 'light' ? 'Light' : 'Dark',
        autosize: true,
        timezone: 'Asia/Kolkata',
        disabled_features: ['use_localstorage_for_settings', 'header_symbol_search'],
        enabled_features: [],
      });
      widgetRef.current = w;
      try { w.onChartReady?.(() => { if (!cancelled) setReady(true); }); } catch { /* noop */ }
    }).catch(() => { /* library missing/unapproved */ });

    return () => {
      cancelled = true;
      setReady(false);
      try { widgetRef.current?.remove?.(); } catch { /* noop */ }
      widgetRef.current = null;
      linesRef.current.clear();
    };
  }, [selectedSymbol, theme]);

  // Reconcile BUY/SELL position lines whenever positions change (or once the
  // chart becomes ready).
  useEffect(() => {
    const w = widgetRef.current;
    if (!ready || !w?.activeChart) return;
    let chart: any;
    try { chart = w.activeChart(); } catch { return; }
    if (!chart?.createPositionLine) return;

    const sym = (selectedSymbol || '').toUpperCase();
    const mine = positions.filter((p) => (p.symbol || '').toUpperCase() === sym);
    const seen = new Set<string>();

    for (const p of mine) {
      seen.add(p.id);
      const color = p.side === 'buy' ? '#22c55e' : '#ef4444';
      const pnl = Number(p.profit || 0);
      const label = `${p.side.toUpperCase()} ${p.lots}  ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`;

      let line = linesRef.current.get(p.id);
      if (!line) {
        try {
          line = chart.createPositionLine();
          line.setLineColor(color)
            .setBodyBackgroundColor(color).setBodyBorderColor(color).setBodyTextColor('#ffffff')
            .setQuantityBackgroundColor(color).setQuantityBorderColor(color);
          linesRef.current.set(p.id, line);
        } catch { continue; }
      }
      try {
        // Recolour in case the side/PnL flipped, then update price + labels.
        line.setLineColor(color).setBodyBackgroundColor(color).setBodyBorderColor(color)
          .setQuantityBackgroundColor(color).setQuantityBorderColor(color)
          .setPrice(Number(p.open_price)).setText(label).setQuantity(String(p.lots));
      } catch { /* noop */ }
    }

    // Drop lines for positions that closed / left this symbol.
    for (const [id, line] of linesRef.current) {
      if (!seen.has(id)) {
        try { line.remove(); } catch { /* noop */ }
        linesRef.current.delete(id);
      }
    }
  }, [positions, selectedSymbol, ready]);

  return <div ref={containerRef} className="w-full h-full min-h-[320px]" />;
}
