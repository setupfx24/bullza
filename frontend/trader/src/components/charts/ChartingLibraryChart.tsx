'use client';

/**
 * Full TradingView Charting Library chart — pro UI fed by OUR engine data so the
 * candles match the running P&L (unlike the Advanced Chart WIDGET, which streams
 * TradingView's public OANDA feed). Wires the licensed library in
 * `public/charting_library/` to `swisDexDatafeed` (history = gateway
 * /instruments/{sym}/bars from the InfoWay BarAggregator; live = /ws/bars).
 *
 * Revert to '@/components/charts/AdvancedChart' for the public widget.
 */
import { useEffect, useRef } from 'react';
import { useTradingStore } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';
import { swisDexDatafeed } from '@/lib/charting/datafeed';

// The licensed library attaches `TradingView` to window once the script runs.
type TVWidgetCtor = new (opts: Record<string, unknown>) => { remove?: () => void };
declare global {
  interface Window { TradingView?: { widget?: TVWidgetCtor } }
}

// Load the library script once across all chart instances.
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
  const theme = useUIStore((s) => s.theme);
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<{ remove?: () => void } | null>(null);

  // Recreate the widget when the symbol or theme changes. Simple + reliable for
  // a first integration; can be optimised to widget.setSymbol() later.
  useEffect(() => {
    let cancelled = false;

    loadChartingLibrary().then(() => {
      if (cancelled || !containerRef.current || !window.TradingView?.widget) return;
      try { widgetRef.current?.remove?.(); } catch { /* noop */ }
      widgetRef.current = new window.TradingView.widget({
        symbol: selectedSymbol || 'XAUUSD',
        interval: '5',
        container: containerRef.current,
        datafeed: swisDexDatafeed,
        library_path: '/charting_library/',
        locale: 'en',
        theme: theme === 'light' ? 'Light' : 'Dark',
        autosize: true,
        timezone: 'Asia/Kolkata',
        // Symbol is driven by the trader store, not the chart's own search.
        disabled_features: ['use_localstorage_for_settings', 'header_symbol_search'],
        enabled_features: [],
      });
    }).catch(() => { /* library missing/unapproved — leave the container blank */ });

    return () => {
      cancelled = true;
      try { widgetRef.current?.remove?.(); } catch { /* noop */ }
      widgetRef.current = null;
    };
  }, [selectedSymbol, theme]);

  return <div ref={containerRef} className="w-full h-full min-h-[320px]" />;
}
