'use client';

/**
 * AI Station read-only chart — a self-contained TradingView Charting Library
 * widget that plots AI-Station trades the way a real trading terminal shows
 * them: an entry arrow, an entry price line for OPEN trades (like a live
 * position line), and an exit flag + entry→exit connector for CLOSED trades.
 * NO stop-loss / take-profit lines. Strictly read-only: no broker, no order UI,
 * no drawing tools.
 *
 * Reuses the shared `swisDexDatafeed` (unchanged) so bars/live candles match the
 * real terminal, and deliberately does NOT import the live terminal's chart
 * component so production is never touched.
 */
import { useEffect, useRef, useState } from 'react';
import { swisDexDatafeed } from '@/lib/charting/datafeed';
import { useUIStore } from '@/stores/uiStore';

export interface AiTrade {
  side: 'buy' | 'sell';
  status: 'open' | 'closed';
  entryTime: number;              // UNIX seconds
  entryPrice: number;
  exitTime?: number | null;
  exitPrice?: number | null;
  entryText?: string;
  exitText?: string;
}

interface Props { symbol: string; interval?: string; trades?: AiTrade[]; }

type TVWidget = {
  onChartReady?: (cb: () => void) => void;
  activeChart?: () => any;
  remove?: () => void;
};

function tvCtor(): (new (o: any) => TVWidget) | undefined {
  return (typeof window !== 'undefined' ? (window as any).TradingView?.widget : undefined);
}

let _libPromise: Promise<void> | null = null;
function loadLib(): Promise<void> {
  if (typeof window === 'undefined' || tvCtor()) return Promise.resolve();
  if (_libPromise) return _libPromise;
  _libPromise = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = '/charting_library/charting_library.standalone.js';
    s.async = true;
    s.onload = () => res();
    s.onerror = () => { _libPromise = null; rej(new Error('charting lib failed')); };
    document.head.appendChild(s);
  });
  return _libPromise;
}

const BUY = '#22c55e';
const SELL = '#ef4444';

export default function AiStationChart({ symbol, interval = '5', trades = [] }: Props) {
  const theme = useUIStore((s) => s.theme);
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<TVWidget | null>(null);
  const shapeIdsRef = useRef<any[]>([]);
  const lastSigRef = useRef('');
  const [ready, setReady] = useState(false);

  // (Re)create the widget on symbol / theme change.
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    loadLib().then(() => {
      const Ctor = tvCtor();
      if (cancelled || !containerRef.current || !Ctor) return;
      try { widgetRef.current?.remove?.(); } catch { /* noop */ }
      const w = new Ctor({
        symbol,
        interval,
        container: containerRef.current,
        datafeed: swisDexDatafeed,
        library_path: '/charting_library/',
        locale: 'en',
        theme: theme === 'light' ? 'Light' : 'Dark',
        autosize: true,
        timezone: 'Asia/Kolkata',
        // Read-only: strip trading + drawing + save/load chrome.
        disabled_features: [
          'header_symbol_search', 'header_compare', 'header_saveload',
          'left_toolbar', 'context_menus', 'edit_buttons_in_legend',
          'control_bar', 'header_undo_redo', 'trading_account_manager',
          'show_object_tree',
        ],
        enabled_features: [],
      });
      widgetRef.current = w;
      shapeIdsRef.current = [];   // old chart (and its shapes) are gone
      lastSigRef.current = '';    // force a re-plot on the fresh chart
      try { w.onChartReady?.(() => { if (!cancelled) setReady(true); }); } catch { /* noop */ }
    }).catch(() => { /* lib load failed — container stays blank */ });
    return () => {
      cancelled = true;
      try { widgetRef.current?.remove?.(); } catch { /* noop */ }
      widgetRef.current = null;
    };
  }, [theme, symbol, interval]);

  // Plot / re-plot trade shapes whenever they (or readiness) change.
  useEffect(() => {
    const w = widgetRef.current;
    if (!ready || !w?.activeChart) return;
    let chart: any;
    try { chart = w.activeChart(); } catch { return; }
    if (!chart?.createShape) return;

    // Skip when unchanged (avoids a re-plot flicker every poll).
    const sig = JSON.stringify(trades);
    if (sig === lastSigRef.current) return;
    lastSigRef.current = sig;

    for (const id of shapeIdsRef.current) { try { chart.removeEntity(id); } catch { /* noop */ } }
    shapeIdsRef.current = [];

    const track = (p: any) => {
      if (p && typeof p.then === 'function') p.then((id: any) => shapeIdsRef.current.push(id)).catch(() => {});
      else if (p !== undefined) shapeIdsRef.current.push(p);
    };
    const baseOpts = { lock: true, disableSelection: true, disableSave: true, disableUndo: true };

    for (const t of trades) {
      const color = t.side === 'buy' ? BUY : SELL;

      // Entry arrow (buy = up, sell = down).
      try {
        track(chart.createShape(
          { time: t.entryTime, price: t.entryPrice },
          { ...baseOpts, shape: t.side === 'buy' ? 'arrow_up' : 'arrow_down',
            text: t.entryText ?? `${t.side.toUpperCase()} @ ${t.entryPrice}`,
            overrides: { color, textcolor: color, fontsize: 11, bold: true } },
        ));
      } catch { /* noop */ }

      if (t.status === 'open') {
        // Open trade → entry price line across the chart (position-line look).
        try {
          track(chart.createShape(
            { time: t.entryTime, price: t.entryPrice },
            { ...baseOpts, shape: 'horizontal_line',
              overrides: { linecolor: color, linewidth: 1, linestyle: 2, showPrice: true } },
          ));
        } catch { /* noop */ }
      } else if (t.exitTime && t.exitPrice != null) {
        // Closed trade → exit flag + entry→exit connector.
        try {
          track(chart.createShape(
            { time: t.exitTime, price: t.exitPrice },
            { ...baseOpts, shape: 'flag',
              text: t.exitText ?? `exit @ ${t.exitPrice}`,
              overrides: { color, textcolor: color, fontsize: 11, bold: true } },
          ));
        } catch { /* noop */ }
        try {
          track(chart.createMultipointShape(
            [{ time: t.entryTime, price: t.entryPrice }, { time: t.exitTime, price: t.exitPrice }],
            { ...baseOpts, shape: 'trend_line',
              overrides: { linecolor: color, linewidth: 1, linestyle: 2 } },
          ));
        } catch { /* noop */ }
      }
    }
    // No cleanup here: shapes are torn down when the widget rebuilds
    // (symbol/theme change resets the refs) or on unmount (widget.remove()).
  }, [ready, trades]);

  return (
    <div className="relative w-full h-full min-h-[300px]">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
