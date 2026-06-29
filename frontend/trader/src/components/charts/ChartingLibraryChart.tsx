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
// a few methods, each guarded by try/catch. Read it via a local cast rather
// than augmenting the global Window (AdvancedChart.tsx already declares
// window.TradingView with a different widget type — augmenting again clashes).
type TVWidget = { onChartReady?: (cb: () => void) => void; activeChart?: () => any; remove?: () => void };
type TVWidgetCtor = new (opts: Record<string, unknown>) => TVWidget;
function tvCtor(): TVWidgetCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { TradingView?: { widget?: TVWidgetCtor } }).TradingView?.widget;
}

let _libPromise: Promise<void> | null = null;
function loadChartingLibrary(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (tvCtor()) return Promise.resolve();
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
  // The symbol the widget is currently displaying. Used to avoid a redundant
  // setSymbol() right after creation and to detect a real change.
  const appliedSymbolRef = useRef<string>('');
  const [ready, setReady] = useState(false);

  // Create the widget once (and recreate ONLY on theme change — that needs a
  // full rebuild). The symbol is intentionally NOT a dependency here: changing
  // it is handled in-place by the effect below via setSymbol(). Tearing down and
  // rebuilding the whole widget on every symbol change left a visible window
  // where the chart still showed the OLD symbol while the order ticket already
  // showed the NEW one — and if the async rebuild errored (swallowed below) the
  // chart got stuck on the stale symbol (live desync 2026-06-29: chart EURUSD
  // vs ticket XAUUSD).
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    linesRef.current.clear();

    loadChartingLibrary().then(() => {
      const Ctor = tvCtor();
      if (cancelled || !containerRef.current || !Ctor) return;
      try { widgetRef.current?.remove?.(); } catch { /* noop */ }
      // Read the latest symbol from the store at creation time (the effect does
      // not depend on it, so the closure value could be stale).
      const initialSymbol = useTradingStore.getState().selectedSymbol || 'XAUUSD';
      const w = new Ctor({
        symbol: initialSymbol,
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
        // Faint SwisDex/symbol watermark in the chart background (restores the
        // branding the old Advanced Chart widget showed) — client 2026-06-26.
        overrides: {
          'symbolWatermarkProperties.transparency': 84,
          'symbolWatermarkProperties.color': theme === 'light'
            ? 'rgba(40,40,40,0.10)' : 'rgba(200,200,200,0.10)',
        },
      });
      widgetRef.current = w;
      appliedSymbolRef.current = initialSymbol;
      try { w.onChartReady?.(() => { if (!cancelled) setReady(true); }); } catch { /* noop */ }
    }).catch(() => { /* library missing/unapproved */ });

    return () => {
      cancelled = true;
      setReady(false);
      try { widgetRef.current?.remove?.(); } catch { /* noop */ }
      widgetRef.current = null;
      appliedSymbolRef.current = '';
      linesRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  // Change the symbol IN PLACE when selectedSymbol changes — keeps the chart in
  // lock-step with the order ticket (both read the same store symbol) instead of
  // rebuilding the widget. TradingView drives the datafeed's unsubscribe →
  // resolveSymbol → getBars → subscribeBars for the new symbol.
  useEffect(() => {
    if (!ready) return;
    const w = widgetRef.current;
    const sym = selectedSymbol || 'XAUUSD';
    if (!w?.activeChart || appliedSymbolRef.current === sym) return;
    try {
      const chart = w.activeChart();
      // Position lines are symbol-specific overlays; drop our refs so the
      // reconcile effect re-creates them for the new symbol.
      for (const [, line] of linesRef.current) { try { line.remove(); } catch { /* noop */ } }
      linesRef.current.clear();
      chart?.setSymbol?.(sym, () => { /* resolved */ });
      appliedSymbolRef.current = sym;
    } catch { /* noop */ }
  }, [selectedSymbol, ready]);

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

    // Build the full set of desired lines: entry + (SL) + (TP) per position.
    // dashed=true → SL/TP drawn as a dashed line to stand apart from the entry.
    type Desired = { key: string; price: number; color: string; text: string; qty: string; dashed: boolean };
    const desired: Desired[] = [];
    for (const p of mine) {
      const entryColor = p.side === 'buy' ? '#22c55e' : '#ef4444';
      const pnl = Number(p.profit || 0);
      desired.push({
        key: p.id, price: Number(p.open_price), color: entryColor,
        text: `${p.side.toUpperCase()} ${p.lots}  ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`,
        qty: String(p.lots), dashed: false,
      });
      if (p.stop_loss && Number(p.stop_loss) > 0) {
        desired.push({ key: `${p.id}-sl`, price: Number(p.stop_loss), color: '#f59e0b', text: 'SL', qty: '', dashed: true });
      }
      if (p.take_profit && Number(p.take_profit) > 0) {
        desired.push({ key: `${p.id}-tp`, price: Number(p.take_profit), color: '#14b8a6', text: 'TP', qty: '', dashed: true });
      }
    }

    const seen = new Set<string>();
    for (const d of desired) {
      seen.add(d.key);
      let line = linesRef.current.get(d.key);
      if (!line) {
        try { line = chart.createPositionLine(); linesRef.current.set(d.key, line); }
        catch { continue; }
      }
      try {
        line.setPrice(d.price)
          .setText(d.text).setQuantity(d.qty)
          .setLineColor(d.color).setLineStyle(d.dashed ? 1 : 0)
          .setBodyBackgroundColor(d.color).setBodyBorderColor(d.color).setBodyTextColor('#ffffff')
          .setQuantityBackgroundColor(d.color).setQuantityBorderColor(d.color);
      } catch { /* noop */ }
    }

    // Drop lines for positions / SL / TP that are gone.
    for (const [key, line] of linesRef.current) {
      if (!seen.has(key)) {
        try { line.remove(); } catch { /* noop */ }
        linesRef.current.delete(key);
      }
    }
  }, [positions, selectedSymbol, ready]);

  return <div ref={containerRef} className="w-full h-full min-h-[320px]" />;
}
