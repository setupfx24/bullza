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
import toast from 'react-hot-toast';
import { useTradingStore } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';
import { swisDexDatafeed } from '@/lib/charting/datafeed';
import api from '@/lib/api/client';

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

// ── Drag / cancel handlers for the interactive chart order-lines ──────────
// Attached once to a TradingView orderLine. `this` is the line, so we read the
// dropped price via this.getPrice(), PUT it to the backend, then refresh the
// store so the line snaps to the server truth. On rejection we revert the line
// to the last-known value. Fresh data is read from the store at call time so a
// stale closure can't send an outdated SL/TP.
function _movePositionField(posId: string, field: 'stop_loss' | 'take_profit') {
  return function (this: any) {
    const line = this;
    const price = Number(line.getPrice());
    const st = useTradingStore.getState();
    const pos = (st.positions || []).find((p: any) => p.id === posId);
    const body: any = {
      stop_loss: pos?.stop_loss ?? null,
      take_profit: pos?.take_profit ?? null,
    };
    body[field] = price;
    api.put(`/positions/${posId}`, body)
      .then(() => { toast.success(field === 'stop_loss' ? 'Stop loss updated' : 'Take profit updated'); st.refreshPositions(); })
      .catch((e: any) => {
        toast.error(e?.message || 'Update failed');
        const orig = field === 'stop_loss' ? pos?.stop_loss : pos?.take_profit;
        if (orig) { try { line.setPrice(Number(orig)); } catch { /* noop */ } }
      });
  };
}

function _moveOrderField(orderId: string, field: 'price' | 'stop_loss' | 'take_profit') {
  return function (this: any) {
    const line = this;
    const price = Number(line.getPrice());
    const st = useTradingStore.getState();
    const ord = (st.pendingOrders || []).find((o: any) => o.id === orderId);
    api.put(`/orders/${orderId}`, { [field]: price })
      .then(() => { toast.success('Order updated'); st.refreshPendingOrders(); })
      .catch((e: any) => {
        toast.error(e?.message || 'Update failed');
        const orig = field === 'price' ? ord?.price : field === 'stop_loss' ? ord?.stop_loss : ord?.take_profit;
        if (orig) { try { line.setPrice(Number(orig)); } catch { /* noop */ } }
      });
  };
}

function _cancelOrder(orderId: string) {
  return function () {
    const st = useTradingStore.getState();
    api.delete(`/orders/${orderId}`)
      .then(() => { toast.success('Order cancelled'); st.refreshPendingOrders(); })
      .catch((e: any) => { toast.error(e?.message || 'Cancel failed'); });
  };
}


export default function ChartingLibraryChart() {
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const positions = useTradingStore((s) => s.positions);
  const pendingOrders = useTradingStore((s) => s.pendingOrders);
  const theme = useUIStore((s) => s.theme);

  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<TVWidget | null>(null);
  // Map position id -> chart position-line object, so we update/remove in place.
  const linesRef = useRef<Map<string, any>>(new Map());
  // Live BUY (ask) / SELL (bid) quote lines — kept OUT of linesRef so the
  // positions/orders reconcile effect (which prunes lines not in its `seen`
  // set) never removes them.
  const liveLinesRef = useRef<{ ask: any; bid: any } | null>(null);
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

  // Reconcile chart lines whenever positions / pending orders change. Open
  // positions get an entry line (P&L) plus DRAGGABLE SL/TP lines; pending
  // orders get a draggable+cancellable entry line plus their SL/TP. Dragging an
  // SL/TP/entry line PUTs the new price to the backend (see the _move* helpers).
  useEffect(() => {
    const w = widgetRef.current;
    if (!ready || !w?.activeChart) return;
    let chart: any;
    try { chart = w.activeChart(); } catch { return; }
    if (!chart?.createPositionLine) return;

    const sym = (selectedSymbol || '').toUpperCase();
    const myPos = positions.filter((p) => (p.symbol || '').toUpperCase() === sym);
    const myPending = (pendingOrders || []).filter((o: any) => (o.symbol || '').toUpperCase() === sym);

    type Desired = {
      key: string; price: number; color: string; text: string; qty: string;
      dashed: boolean;
      // 'position' → createPositionLine (static, shows P&L). 'order' →
      // createOrderLine (DRAGGABLE; onMove/onCancel handlers).
      kind: 'position' | 'order';
      onMove?: (this: any) => void;
      onCancel?: () => void;
    };
    const desired: Desired[] = [];

    // ── Open positions ──
    for (const p of myPos) {
      const entryColor = p.side === 'buy' ? '#22c55e' : '#ef4444';
      const pnl = Number(p.profit || 0);
      desired.push({
        key: p.id, price: Number(p.open_price), color: entryColor,
        text: `${p.side.toUpperCase()} ${p.lots}  ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`,
        qty: String(p.lots), dashed: false, kind: 'position',
      });
      if (p.stop_loss && Number(p.stop_loss) > 0) {
        desired.push({ key: `${p.id}-sl`, price: Number(p.stop_loss), color: '#f59e0b', text: 'SL', qty: '', dashed: true, kind: 'order', onMove: _movePositionField(p.id, 'stop_loss') });
      }
      if (p.take_profit && Number(p.take_profit) > 0) {
        desired.push({ key: `${p.id}-tp`, price: Number(p.take_profit), color: '#14b8a6', text: 'TP', qty: '', dashed: true, kind: 'order', onMove: _movePositionField(p.id, 'take_profit') });
      }
    }

    // ── Pending orders (limit/stop) ──
    for (const o of myPending) {
      const pColor = o.side === 'buy' ? '#3b82f6' : '#a855f7';
      desired.push({
        key: `ord-${o.id}`, price: Number(o.price), color: pColor,
        text: `${String(o.order_type || '').toUpperCase()} ${o.side.toUpperCase()}`,
        qty: String(o.lots), dashed: false, kind: 'order',
        onMove: _moveOrderField(o.id, 'price'), onCancel: _cancelOrder(o.id),
      });
      if (o.stop_loss && Number(o.stop_loss) > 0) {
        desired.push({ key: `ord-${o.id}-sl`, price: Number(o.stop_loss), color: '#f59e0b', text: 'SL', qty: '', dashed: true, kind: 'order', onMove: _moveOrderField(o.id, 'stop_loss') });
      }
      if (o.take_profit && Number(o.take_profit) > 0) {
        desired.push({ key: `ord-${o.id}-tp`, price: Number(o.take_profit), color: '#14b8a6', text: 'TP', qty: '', dashed: true, kind: 'order', onMove: _moveOrderField(o.id, 'take_profit') });
      }
    }

    const seen = new Set<string>();
    for (const d of desired) {
      seen.add(d.key);
      let line = linesRef.current.get(d.key);
      if (!line) {
        try {
          line = (d.kind === 'order' && chart.createOrderLine) ? chart.createOrderLine() : chart.createPositionLine();
          linesRef.current.set(d.key, line);
          // Drag / cancel handlers are attached ONCE at creation (order lines
          // only). They close over the stable id and read fresh data at call
          // time, so re-rendering doesn't need to re-bind them.
          if (d.kind === 'order') {
            try { if (d.onMove && line.onMove) line.onMove(d.onMove); } catch { /* noop */ }
            try { if (d.onCancel && line.onCancel) line.onCancel(d.onCancel); } catch { /* noop */ }
          }
        } catch { continue; }
      }
      try {
        line.setPrice(d.price)
          .setText(d.text).setQuantity(d.qty)
          .setLineColor(d.color).setLineStyle(d.dashed ? 1 : 0)
          .setBodyBackgroundColor(d.color).setBodyBorderColor(d.color).setBodyTextColor('#ffffff')
          .setQuantityBackgroundColor(d.color).setQuantityBorderColor(d.color);
      } catch { /* noop */ }
      if (d.onCancel) {
        try { line.setCancelButtonBorderColor(d.color).setCancelButtonBackgroundColor(d.color).setCancelButtonIconColor('#ffffff'); } catch { /* noop */ }
      }
    }

    // Drop lines whose position / order / SL / TP is gone.
    for (const [key, line] of linesRef.current) {
      if (!seen.has(key)) {
        try { line.remove(); } catch { /* noop */ }
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
      lock: true, disableSelection: true, disableSave: true, disableUndo: true,
      overrides: {
        linecolor: color, linestyle: 0, linewidth: 1,
        showLabel: true, text, textcolor: color, fontsize: 11, bold: true,
        showPrice: true, horzLabelsAlign: 'right', vertLabelsAlign: vAlign,
      },
    });

    const apply = (tick: { bid: number; ask: number } | undefined) => {
      if (!tick || !(tick.bid > 0) || !(tick.ask > 0)) return;
      const t = Math.floor(Date.now() / 1000);
      try {
        if (!liveLinesRef.current) {
          liveLinesRef.current = {
            ask: chart.createShape({ time: t, price: tick.ask }, opts('BUY', '#22c55e', 'bottom')),
            bid: chart.createShape({ time: t, price: tick.bid }, opts('SELL', '#ef4444', 'top')),
          };
        } else {
          try { chart.getShapeById(liveLinesRef.current.ask)?.setPoints([{ time: t, price: tick.ask }]); } catch { /* noop */ }
          try { chart.getShapeById(liveLinesRef.current.bid)?.setPoints([{ time: t, price: tick.bid }]); } catch { /* noop */ }
        }
      } catch { /* noop */ }
    };

    apply(useTradingStore.getState().prices[sym]);
    const unsub = useTradingStore.subscribe((state) => apply(state.prices[sym]));

    return () => {
      try { unsub(); } catch { /* noop */ }
      try { if (liveLinesRef.current) { chart.removeEntity(liveLinesRef.current.ask); chart.removeEntity(liveLinesRef.current.bid); } } catch { /* noop */ }
      liveLinesRef.current = null;
    };
  }, [ready, selectedSymbol]);

  return <div ref={containerRef} className="w-full h-full min-h-[320px]" />;
}
