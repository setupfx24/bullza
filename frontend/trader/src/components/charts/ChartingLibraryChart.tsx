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
import { useTradingStore, defaultContractSize } from '@/stores/tradingStore';
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



// localStorage key for the persisted chart layout (drawings, studies,
// settings, timeframe) — survives page refreshes.
const CHART_SAVE_KEY = 'swisdex_chart_layout_v1';

export default function ChartingLibraryChart() {
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const positions = useTradingStore((s) => s.positions);
  const pendingOrders = useTradingStore((s) => s.pendingOrders);
  const theme = useUIStore((s) => s.theme);

  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<TVWidget | null>(null);
  // Map position id -> chart position-line object, so we update/remove in place.
  const linesRef = useRef<Map<string, any>>(new Map());
  // Live BUY (ask) / SELL (bid) quote-line shape ids — kept OUT of linesRef so
  // the positions/orders reconcile effect never prunes them. Holds null, the
  // 'creating' sentinel while the async createShape resolves, or { ask, bid }
  // EntityIds once created.
  const liveLinesRef = useRef<any>(null);
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
      // Restore the saved chart layout (drawings, indicators/studies, chart
      // style, timeframe) so a page refresh no longer wipes the user's
      // analysis. Persisted to localStorage via onAutoSaveNeeded below
      // (client 2026-07-08: "on refresh all analysis disappears").
      let savedData: any;
      try {
        const s = localStorage.getItem(CHART_SAVE_KEY);
        if (s) savedData = JSON.parse(s);
      } catch { /* corrupt / no storage → start fresh */ }
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
        // Debounced auto-save fires onAutoSaveNeeded ~2s after any change.
        auto_save_delay: 2,
        // Re-load the previous layout if we have one.
        ...(savedData ? { saved_data: savedData } : {}),
        // Removed 'use_localstorage_for_settings' from disabled so the library
        // also persists chart style/settings per browser.
        disabled_features: ['header_symbol_search'],
        enabled_features: ['study_templates'],
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
      try {
        w.onChartReady?.(() => {
          if (cancelled) return;
          setReady(true);
          // Persist the FULL layout (drawings + studies + settings + interval)
          // on every change so it survives a refresh. save() serialises the
          // whole widget state; we stash it in localStorage. subscribe/save are
          // runtime methods not on the TVWidget type, so go through `any`.
          try {
            const wAny = w as any;
            wAny.subscribe?.('onAutoSaveNeeded', () => {
              try {
                wAny.save?.((state: any) => {
                  try { localStorage.setItem(CHART_SAVE_KEY, JSON.stringify(state)); } catch { /* quota */ }
                });
              } catch { /* noop */ }
            });
          } catch { /* noop */ }
        });
      } catch { /* noop */ }
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
      // Position lines are symbol-specific overlays; remove the shapes (they're
      // createShape entities → removeEntity, not .remove()) and drop our refs so
      // the reconcile effect re-creates them for the new symbol.
      for (const [, entry] of linesRef.current) {
        try { if (entry && entry.id != null) chart?.removeEntity(entry.id); } catch { /* noop */ }
      }
      linesRef.current.clear();
      chart?.setSymbol?.(sym, () => { /* resolved */ });
      appliedSymbolRef.current = sym;
    } catch { /* noop */ }
  }, [selectedSymbol, ready]);

  // Reconcile chart lines whenever positions / pending orders change. Each open
  // position gets an ENTRY line labelled with its LIVE P&L and coloured by
  // profit/loss (green/red/gray), throttled to 500ms; plus SL (amber) / TP
  // (teal). Each pending order gets its entry (BUY blue / SELL purple) + SL/TP.
  //
  // Drawn with createShape('horizontal_line') — the CORE Charting Library API.
  // createPositionLine/createOrderLine are Trading-Terminal-only and render
  // NOTHING in this build, which is why the entry lines were invisible. Shapes
  // span the FULL chart width and stay pinned to the price scale through
  // zoom / scroll / timeframe changes; they're created once, moved with
  // setPoints when a price (e.g. SL/TP) changes, and removed when the
  // position/order closes. linesRef maps key -> { id, price, creating }.
  //
  // Trade-off vs the old (invisible) order lines: these aren't drag-to-modify.
  // Since the draggable lines never rendered, visible-but-static is strictly
  // better; SL/TP is still edited from the positions table.
  useEffect(() => {
    const w = widgetRef.current;
    if (!ready || !w?.activeChart) return;
    let chart: any;
    try { chart = w.activeChart(); } catch { return; }
    if (!chart?.createShape) return;

    const sym = (selectedSymbol || '').toUpperCase();
    const myPos = positions.filter((p) => (p.symbol || '').toUpperCase() === sym);
    const myPending = (pendingOrders || []).filter((o: any) => (o.symbol || '').toUpperCase() === sym);
    const inst = useTradingStore.getState().instruments.find(
      (i) => String(i.symbol).toUpperCase() === sym,
    );
    const digits = inst?.digits ?? 2;
    const cs = Number(inst?.contract_size) || defaultContractSize(sym);
    const fp = (n: number) => Number(n).toFixed(digits);

    // P&L → line colour: green in profit, red in loss, gray near break-even.
    const pnlColor = (pnl: number) =>
      Math.abs(pnl) < 0.10 ? '#9ca3af' : pnl > 0 ? '#10b981' : '#ef4444';

    type Desired = { key: string; price: number; color: string; text: string; dashed: boolean; pnl?: number };
    const desired: Desired[] = [];

    // ── Open positions: entry line labelled with LIVE P&L, coloured by P&L
    //    state (not side). p.profit is the SAME value the positions table and
    //    top floating-P&L bar use (livePnlFor) → single source of truth, so the
    //    line can never disagree with the table. SL (amber) / TP (teal) too. ──
    for (const p of myPos) {
      const pnl = Number(p.profit || 0);
      const lots = Number(p.lots || 0);
      const entry = Number(p.open_price || 0);
      const notional = entry * lots * cs;
      const pct = notional > 0 ? (pnl / notional) * 100 : 0;
      const pnlStr = `${pnl >= 0 ? '+' : '-'}$${Math.abs(pnl).toFixed(2)}`;
      const pctStr = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
      desired.push({
        key: p.id, price: entry, color: pnlColor(pnl),
        text: `${p.side.toUpperCase()} ${lots} @ ${fp(entry)} | ${pnlStr} (${pctStr})`,
        dashed: false, pnl,
      });
      if (p.stop_loss && Number(p.stop_loss) > 0)
        desired.push({ key: `${p.id}-sl`, price: Number(p.stop_loss), color: '#f59e0b', text: `SL ${fp(Number(p.stop_loss))}`, dashed: true });
      if (p.take_profit && Number(p.take_profit) > 0)
        desired.push({ key: `${p.id}-tp`, price: Number(p.take_profit), color: '#14b8a6', text: `TP ${fp(Number(p.take_profit))}`, dashed: true });
    }

    // ── Pending orders (limit/stop): entry + SL + TP. ──
    for (const o of myPending) {
      const pColor = o.side === 'buy' ? '#3b82f6' : '#a855f7';
      desired.push({ key: `ord-${o.id}`, price: Number(o.price), color: pColor,
        text: `${String(o.order_type || '').toUpperCase()} ${o.side.toUpperCase()} ${fp(Number(o.price))}`, dashed: true });
      if (o.stop_loss && Number(o.stop_loss) > 0)
        desired.push({ key: `ord-${o.id}-sl`, price: Number(o.stop_loss), color: '#f59e0b', text: `SL ${fp(Number(o.stop_loss))}`, dashed: true });
      if (o.take_profit && Number(o.take_profit) > 0)
        desired.push({ key: `ord-${o.id}-tp`, price: Number(o.take_profit), color: '#14b8a6', text: `TP ${fp(Number(o.take_profit))}`, dashed: true });
    }

    const shapeOpts = (text: string, color: string, dashed: boolean) => ({
      shape: 'horizontal_line',
      text,
      lock: true, disableSelection: true, disableSave: true, disableUndo: true,
      overrides: {
        linecolor: color, linestyle: dashed ? 2 : 0, linewidth: dashed ? 1 : 2,
        showLabel: true, textcolor: color, fontsize: 11, bold: true,
        horzLabelsAlign: 'right', vertLabelsAlign: 'middle',
      },
    });

    const t = Math.floor(Date.now() / 1000);
    const now = Date.now();
    // Throttle the live-P&L label refresh: 500ms normally, 1000ms once 10+
    // positions are open, so streaming ticks never thrash the chart.
    const throttleMs = myPos.length >= 10 ? 1000 : 500;
    const wanted = new Set(desired.map((d) => d.key));

    for (const d of desired) {
      const existing = linesRef.current.get(d.key);
      if (!existing) {
        // createShape is ASYNC (Promise<EntityId>). Reserve the key with a
        // 'creating' entry so a re-render mid-create doesn't spawn a duplicate.
        const entry: any = { id: null, price: d.price, creating: true, text: d.text, color: d.color, pnl: d.pnl ?? null, propAt: now };
        linesRef.current.set(d.key, entry);
        chart.createShape({ time: t, price: d.price }, shapeOpts(d.text, d.color, d.dashed))
          .then((id: any) => {
            if (linesRef.current.get(d.key) === entry) { entry.id = id; entry.creating = false; }
            else { try { chart.removeEntity(id); } catch { /* closed mid-create */ } }
          })
          .catch(() => { if (linesRef.current.get(d.key) === entry) linesRef.current.delete(d.key); });
      } else if (existing.id != null) {
        // Price moved (SL/TP edited) → slide the existing line, no recreate.
        if (existing.price !== d.price) {
          try { chart.getShapeById(existing.id)?.setPoints([{ time: t, price: d.price }]); } catch { /* noop */ }
          existing.price = d.price;
        }
        // Live label + colour refresh. For P&L lines (entry): throttle AND
        // only when P&L moved > $0.01 or the profit/loss colour flipped — so we
        // don't setProperties on every micro-tick. SL/TP/order labels are
        // static, so they update immediately when they actually change.
        if (d.text !== existing.text || d.color !== existing.color) {
          const isPnl = d.pnl != null;
          const throttleOk = !isPnl || (now - (existing.propAt || 0) >= throttleMs);
          const worthIt = !isPnl
            || d.color !== existing.color
            || Math.abs((d.pnl as number) - (existing.pnl ?? 0)) > 0.01;
          if (throttleOk && worthIt) {
            try {
              chart.getShapeById(existing.id)?.setProperties({
                text: d.text, linecolor: d.color, textcolor: d.color,
              });
            } catch { /* keep last-known label on error */ }
            existing.text = d.text;
            existing.color = d.color;
            existing.pnl = d.pnl ?? existing.pnl;
            existing.propAt = now;
          }
        }
      }
    }

    // Remove lines whose position / order / SL / TP is gone (or symbol changed).
    for (const [key, entry] of linesRef.current) {
      if (!wanted.has(key)) {
        if (entry && entry.id != null) { try { chart.removeEntity(entry.id); } catch { /* noop */ } }
        linesRef.current.delete(key);
      }
    }
  }, [positions, pendingOrders, selectedSymbol, ready]);

  // Live BUY / SELL price lines that track the current quote (MT4/MT5 style):
  // a green BUY line at the ASK and a red SELL line at the BID, updated on every
  // tick. Uses createShape('horizontal_line') — the CORE Charting Library API —
  // NOT createPositionLine, which is a Trading-Terminal-only feature that isn't
  // present in this build (it silently drew nothing). Shapes are created once
  // then moved with setPoints so there's no flicker.
  useEffect(() => {
    const w = widgetRef.current;
    if (!ready || !w?.activeChart) return;
    let chart: any;
    try { chart = w.activeChart(); } catch { return; }
    if (!chart?.createShape) return;
    const sym = (selectedSymbol || '').toUpperCase();

    const opts = (text: string, color: string, vAlign: 'top' | 'bottom') => ({
      shape: 'horizontal_line',
      text,                                   // top-level in CreateShapeOptions
      lock: true, disableSelection: true, disableSave: true, disableUndo: true,
      overrides: {
        linecolor: color, linestyle: 0, linewidth: 1,
        showLabel: true, textcolor: color, fontsize: 11, bold: true,
        horzLabelsAlign: 'right', vertLabelsAlign: vAlign,
      },
    });

    const move = (id: any, t: number, price: number) => {
      try { chart.getShapeById(id)?.setPoints([{ time: t, price }]); } catch { /* noop */ }
    };

    const apply = (tick: { bid: number; ask: number } | undefined) => {
      if (!tick || !(tick.bid > 0) || !(tick.ask > 0)) return;
      const t = Math.floor(Date.now() / 1000);
      const cur = liveLinesRef.current;
      if (cur === 'creating') return;         // async create in flight — wait
      if (cur && cur.ask != null) {
        move(cur.ask, t, tick.ask);
        move(cur.bid, t, tick.bid);
        return;
      }
      // createShape is ASYNC (returns Promise<EntityId>) — await both, then
      // store the ids so later ticks just move the shapes.
      liveLinesRef.current = 'creating';
      Promise.all([
        chart.createShape({ time: t, price: tick.ask }, opts('BUY', '#22c55e', 'bottom')),
        chart.createShape({ time: t, price: tick.bid }, opts('SELL', '#ef4444', 'top')),
      ]).then(([ask, bid]: any[]) => { liveLinesRef.current = { ask, bid }; })
        .catch(() => { liveLinesRef.current = null; });
    };

    apply(useTradingStore.getState().prices[sym]);
    const unsub = useTradingStore.subscribe((state) => apply(state.prices[sym]));

    return () => {
      try { unsub(); } catch { /* noop */ }
      const cur = liveLinesRef.current;
      if (cur && cur.ask != null) {
        try { chart.removeEntity(cur.ask); } catch { /* noop */ }
        try { chart.removeEntity(cur.bid); } catch { /* noop */ }
      }
      liveLinesRef.current = null;
    };
  }, [ready, selectedSymbol]);

  return <div ref={containerRef} className="w-full h-full min-h-[320px]" />;
}
