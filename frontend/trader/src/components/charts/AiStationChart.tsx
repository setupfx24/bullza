'use client';

/**
 * AI Station read-only chart — a self-contained TradingView Charting Library
 * widget that plots AI-Station trade entry/exit markers. Strictly read-only:
 * NO broker, NO order UI, NO drawing tools. Reuses the shared `swisDexDatafeed`
 * (unchanged) so bars/live candles match the real terminal.
 *
 * Deliberately does NOT import the live terminal's ChartingLibraryChart so the
 * production terminal is never touched.
 */
import { useEffect, useRef, useState } from 'react';
import { swisDexDatafeed } from '@/lib/charting/datafeed';
import { useUIStore } from '@/stores/uiStore';

export interface TradeMarker {
  time: number;                 // UNIX seconds
  price: number;
  side: 'buy' | 'sell';
  type: 'entry' | 'exit';
  text?: string;
}

interface Props { symbol: string; interval?: string; markers?: TradeMarker[]; }

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

export default function AiStationChart({ symbol, interval = '5', markers = [] }: Props) {
  const theme = useUIStore((s) => s.theme);
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<TVWidget | null>(null);
  const markerIdsRef = useRef<any[]>([]);
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
      markerIdsRef.current = [];   // old chart (and its shapes) are gone
      lastSigRef.current = '';     // force a re-plot on the fresh chart
      try { w.onChartReady?.(() => { if (!cancelled) setReady(true); }); } catch { /* noop */ }
    }).catch(() => { /* lib load failed — container stays blank */ });
    return () => {
      cancelled = true;
      try { widgetRef.current?.remove?.(); } catch { /* noop */ }
      widgetRef.current = null;
    };
  }, [theme, symbol, interval]);

  // Plot / re-plot markers whenever they (or readiness) change.
  useEffect(() => {
    const w = widgetRef.current;
    if (!ready || !w?.activeChart) return;
    let chart: any;
    try { chart = w.activeChart(); } catch { return; }
    if (!chart?.createShape) return;

    // Skip when the marker set is unchanged (avoids a re-plot flicker every poll).
    const sig = JSON.stringify(markers);
    if (sig === lastSigRef.current) return;
    lastSigRef.current = sig;

    for (const id of markerIdsRef.current) { try { chart.removeEntity(id); } catch { /* noop */ } }
    markerIdsRef.current = [];

    const BUY = '#22c55e', SELL = '#ef4444';
    for (const m of markers) {
      const color = m.side === 'buy' ? BUY : SELL;
      const shape = m.type === 'entry'
        ? (m.side === 'buy' ? 'arrow_up' : 'arrow_down')
        : 'flag';
      try {
        const p = chart.createShape(
          { time: m.time, price: m.price },
          {
            shape,
            text: m.text ?? `${m.type.toUpperCase()} ${m.side.toUpperCase()} @ ${m.price}`,
            lock: true,
            disableSelection: true,
            disableSave: true,
            disableUndo: true,
            overrides: { color, textcolor: color, fontsize: 11, bold: true },
          },
        );
        // createShape may return an id or a promise depending on version.
        if (p && typeof p.then === 'function') {
          p.then((id: any) => markerIdsRef.current.push(id)).catch(() => {});
        } else if (p !== undefined) {
          markerIdsRef.current.push(p);
        }
      } catch { /* skip a marker that can't be placed */ }
    }
    // No cleanup here: markers are torn down when the widget rebuilds (symbol/
    // theme change resets the refs) or on unmount (widget.remove()).
  }, [ready, markers]);

  return (
    <div className="relative w-full h-full min-h-[300px]">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
