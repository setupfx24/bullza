'use client';

/**
 * AI Station read-only chart — a self-contained TradingView Charting Library
 * widget that shows AI-Station trades the way a real trading terminal does:
 *   - an entry arrow per trade,
 *   - a horizontal ENTRY PRICE line for OPEN trades whose label shows the live
 *     running P&L (updated in place, no flicker),
 *   - an exit flag + entry→exit connector for CLOSED trades.
 * NO stop-loss / take-profit lines. Strictly read-only: no broker, no order UI,
 * no drawing tools. Reuses the shared `swisDexDatafeed` unchanged, and does NOT
 * import the live terminal's chart component, so production is never touched.
 */
import { useEffect, useRef, useState } from 'react';
import { swisDexDatafeed } from '@/lib/charting/datafeed';
import { useUIStore } from '@/stores/uiStore';

export interface AiTrade {
  id: string;
  side: 'buy' | 'sell';
  status: 'open' | 'closed';
  entryTime: number;              // UNIX seconds
  entryPrice: number;
  exitTime?: number | null;
  exitPrice?: number | null;
  lots: number;
  pnl?: number | null;            // live running P&L (open) / realised (closed)
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
const money = (n: number | null | undefined) =>
  n === null || n === undefined ? '' : `${n >= 0 ? '+' : ''}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const lineLabel = (t: AiTrade) => `${t.side.toUpperCase()} ${t.lots} @ ${t.entryPrice}${t.pnl != null ? '  ' + money(t.pnl) : ''}`;
const structKey = (t: AiTrade) => `${t.id}:${t.status}:${t.entryPrice}:${t.exitPrice ?? ''}`;

export default function AiStationChart({ symbol, interval = '5', trades = [] }: Props) {
  const theme = useUIStore((s) => s.theme);
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<TVWidget | null>(null);
  const shapeIdsRef = useRef<any[]>([]);              // every shape (for clear)
  const openLineRef = useRef<Map<string, any>>(new Map()); // tradeId → line entity id
  const structRef = useRef('');
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
        disabled_features: [
          'header_symbol_search', 'header_compare', 'header_saveload',
          'left_toolbar', 'context_menus', 'edit_buttons_in_legend',
          'control_bar', 'header_undo_redo', 'trading_account_manager',
          'show_object_tree',
        ],
        enabled_features: [],
      });
      widgetRef.current = w;
      shapeIdsRef.current = [];
      openLineRef.current.clear();
      structRef.current = '';
      try { w.onChartReady?.(() => { if (!cancelled) setReady(true); }); } catch { /* noop */ }
    }).catch(() => { /* lib load failed */ });
    return () => {
      cancelled = true;
      try { widgetRef.current?.remove?.(); } catch { /* noop */ }
      widgetRef.current = null;
    };
  }, [theme, symbol, interval]);

  // Structural (re)plot: only when a trade is added / opened→closed / price
  // corrected — NOT on every live-P&L tick.
  useEffect(() => {
    const w = widgetRef.current;
    if (!ready || !w?.activeChart) return;
    let chart: any;
    try { chart = w.activeChart(); } catch { return; }
    if (!chart?.createShape) return;

    const struct = trades.map(structKey).join('|');
    if (struct === structRef.current) return;
    structRef.current = struct;

    for (const id of shapeIdsRef.current) { try { chart.removeEntity(id); } catch { /* noop */ } }
    shapeIdsRef.current = [];
    openLineRef.current.clear();

    const nowSec = Math.floor(Date.now() / 1000);
    const track = (p: any, onId?: (id: any) => void) => {
      if (p && typeof p.then === 'function') p.then((id: any) => { shapeIdsRef.current.push(id); onId?.(id); }).catch(() => {});
      else if (p !== undefined) { shapeIdsRef.current.push(p); onId?.(p); }
    };
    const base = { lock: true, disableSelection: true, disableSave: true, disableUndo: true };

    for (const t of trades) {
      const color = t.side === 'buy' ? BUY : SELL;

      // Entry arrow.
      try {
        track(chart.createShape(
          { time: t.entryTime, price: t.entryPrice },
          { ...base, shape: t.side === 'buy' ? 'arrow_up' : 'arrow_down',
            text: t.entryText ?? `${t.side.toUpperCase()} @ ${t.entryPrice}`,
            overrides: { color, textcolor: color, fontsize: 11, bold: true } },
        ));
      } catch { /* noop */ }

      if (t.status === 'open') {
        // Entry price line across the chart (position-line look) — the same
        // options the live terminal uses, so it actually renders. Label shows
        // side/lots + live P&L, updated in place by the effect below.
        const pnlColor = (t.pnl ?? 0) >= 0 ? BUY : SELL;
        try {
          track(
            chart.createShape(
              { time: nowSec, price: t.entryPrice },
              { ...base, shape: 'horizontal_line', text: lineLabel(t),
                overrides: {
                  linecolor: color, linestyle: 2, linewidth: 1,
                  showLabel: true, textcolor: pnlColor, fontsize: 11, bold: true,
                  horzLabelsAlign: 'right', vertLabelsAlign: 'middle',
                } },
            ),
            (id) => openLineRef.current.set(t.id, id),
          );
        } catch { /* noop */ }
      } else if (t.exitTime && t.exitPrice != null) {
        try {
          track(chart.createShape(
            { time: t.exitTime, price: t.exitPrice },
            { ...base, shape: 'flag', text: t.exitText ?? `exit @ ${t.exitPrice}`,
              overrides: { color, textcolor: color, fontsize: 11, bold: true } },
          ));
        } catch { /* noop */ }
        try {
          track(chart.createMultipointShape(
            [{ time: t.entryTime, price: t.entryPrice }, { time: t.exitTime, price: t.exitPrice }],
            { ...base, shape: 'trend_line', overrides: { linecolor: color, linewidth: 1, linestyle: 2 } },
          ));
        } catch { /* noop */ }
      }
    }
  }, [ready, trades]);

  // Live label refresh: update each OPEN trade's entry-line label + colour in
  // place as its P&L moves — no re-plot, no flicker.
  useEffect(() => {
    const w = widgetRef.current;
    if (!ready || !w?.activeChart) return;
    let chart: any;
    try { chart = w.activeChart(); } catch { return; }
    for (const t of trades) {
      if (t.status !== 'open') continue;
      const eid = openLineRef.current.get(t.id);
      if (eid == null) continue;
      try {
        const shape = chart.getShapeById?.(eid);
        if (!shape?.setProperties) continue;
        const pnlColor = (t.pnl ?? 0) >= 0 ? BUY : SELL;
        shape.setProperties({ text: lineLabel(t), overrides: { textcolor: pnlColor } });
      } catch { /* noop */ }
    }
  }, [ready, trades]);

  return (
    <div className="relative w-full h-full min-h-[300px]">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
