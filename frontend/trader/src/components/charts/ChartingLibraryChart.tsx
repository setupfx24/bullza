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
import api from '@/lib/api/client';
import toast from 'react-hot-toast';

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

// Stale-price thresholds (ms): how long without a tick before a position
// line's P&L is treated as stale. Crypto trades 24/7 (short), forex/metals
// are quiet at weekends (long so we don't spam "stale" when no ticks are
// expected), otherwise a normal live-market threshold.
const STALE_MS = { crypto: 3000, normal: 5000, weekendClosed: 60000 };
const STALE_COLOR = '#6b7280';

// Chart line colours — blue/red industry standard (Vantage / Exness style).
// Blue = anything BUY-related (Ask line, BUY entry, profit); Red = anything
// SELL-related (Bid line, SELL entry, loss). Green/red was ambiguous with the
// P&L palette, so BUY moved to blue. (client 2026-07-09)
const CHART_BUY_COLOR = '#3b82f6';   // blue — BUY (ask) line + BUY position entry line
const CHART_SELL_COLOR = '#ef4444';  // red  — SELL (bid) line + SELL position entry line
const PROFIT_COLOR = '#3b82f6';      // blue — entry-line P&L label when in profit
const LOSS_COLOR = '#ef4444';        // red  — entry-line P&L label when in loss
const BREAKEVEN_COLOR = '#9ca3af';   // gray — entry-line P&L label near break-even

// Vantage-style HTML overlay pill anchoring. The pill sits just left of the
// price axis; ~58px approximates the axis width across timeframes/symbols.
const PRICE_AXIS_W = 58;
// Solid dark chip behind the P&L text/close so it's crisply readable over any
// candles (the old translucent tint blended into the chart). Text stays the
// P&L colour; a thin colour border defines the chip. (client 2026-07-09)
const CHIP_BG = 'rgba(17, 21, 31, 0.95)';

export default function ChartingLibraryChart() {
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const positions = useTradingStore((s) => s.positions);
  const pendingOrders = useTradingStore((s) => s.pendingOrders);
  const theme = useUIStore((s) => s.theme);

  const containerRef = useRef<HTMLDivElement>(null);
  // Overlay layer above the chart for the Vantage-style position pills.
  const overlayRef = useRef<HTMLDivElement>(null);
  // Pane-top offset (top toolbar height) between the pane's own y=0 and the
  // container's y=0, calibrated from crosshair events. null until calibrated.
  const overlayOffsetRef = useRef<number | null>(null);
  const widgetRef = useRef<TVWidget | null>(null);
  // Map position id -> chart position-line object, so we update/remove in place.
  const linesRef = useRef<Map<string, any>>(new Map());
  // Live BUY (ask) / SELL (bid) quote-line shape ids — kept OUT of linesRef so
  // the positions/orders reconcile effect never prunes them. Holds null, the
  // 'creating' sentinel while the async createShape resolves, or { ask, bid }
  // EntityIds once created.
  const liveLinesRef = useRef<any>(null);
  // True while the BUY/SELL quote lines are showing the STALE state, so the
  // next fresh tick knows to restore their normal label/colour.
  const liveStaleRef = useRef(false);
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
      // Explicit background / grid / text colours per app theme. Passed to the
      // widget AND re-applied on ready so a restored (dark) saved_data layout
      // can't leave the chart dark in light mode. (client 2026-07-09)
      const themeOverrides: Record<string, string> = theme === 'light'
        ? {
            'paneProperties.background': '#ffffff',
            'paneProperties.backgroundType': 'solid',
            'paneProperties.vertGridProperties.color': '#ececec',
            'paneProperties.horzGridProperties.color': '#ececec',
            'scalesProperties.textColor': '#131722',
            'scalesProperties.lineColor': '#e0e3eb',
          }
        : {
            'paneProperties.background': '#0c0e12',
            'paneProperties.backgroundType': 'solid',
            'paneProperties.vertGridProperties.color': '#1c1f26',
            'paneProperties.horzGridProperties.color': '#1c1f26',
            'scalesProperties.textColor': '#b2b5be',
            'scalesProperties.lineColor': '#2a2e39',
          };
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
        // NOTE: do NOT enable 'study_templates' — it needs a server
        // charts_storage_url/client_id/user_id, which we don't run, so the
        // library fired GET .../undefined/undefined/study_templates → 404 spam
        // in the console. Layout persistence uses saved_data + onAutoSaveNeeded
        // (localStorage) and does NOT need this feature.
        enabled_features: [],
        // Faint SwisDex/symbol watermark in the chart background (restores the
        // branding the old Advanced Chart widget showed) — client 2026-06-26.
        overrides: {
          'symbolWatermarkProperties.transparency': 84,
          'symbolWatermarkProperties.color': theme === 'light'
            ? 'rgba(40,40,40,0.10)' : 'rgba(200,200,200,0.10)',
          // Theme colours here AND re-applied in onChartReady — a restored
          // saved_data layout carries its own (often dark) background/grid and
          // overrides `theme:'Light'`, which left a dark chart in light mode.
          ...themeOverrides,
        },
      });
      widgetRef.current = w;
      appliedSymbolRef.current = initialSymbol;
      try {
        w.onChartReady?.(() => {
          if (cancelled) return;
          setReady(true);
          // Force the theme colours AFTER saved_data has loaded — its stored
          // (possibly dark) background/grid would otherwise win over theme:'Light'.
          try { (w as any).applyOverrides?.(themeOverrides); } catch { /* noop */ }
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
  // position gets an ENTRY line whose LINE colour is fixed by side (BUY blue /
  // SELL red) and whose LABEL shows the LIVE P&L coloured by profit/loss
  // (blue/red/gray), throttled to 500ms; plus SL (amber) / TP (teal). Each
  // pending order gets its entry (BUY blue / SELL purple, dashed) + SL/TP.
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

    // P&L → LABEL colour: blue in profit, red in loss, gray near break-even.
    const pnlColor = (pnl: number) =>
      Math.abs(pnl) < 0.10 ? BREAKEVEN_COLOR : pnl > 0 ? PROFIT_COLOR : LOSS_COLOR;

    // `color` is the LINE colour, `textColor` the LABEL colour. For position
    // entry lines they differ: the line is fixed by side (BUY blue / SELL red)
    // while the label tracks P&L (profit blue / loss red / gray). SL/TP/pending
    // omit textColor → it falls back to the line colour.
    // `label:false` suppresses the TV shape's text label — used for open-position
    // entry lines, whose label is now the Vantage-style HTML overlay pill.
    type Desired = { key: string; price: number; color: string; textColor?: string; text: string; dashed: boolean; pnl?: number; label?: boolean };
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
      // Line colour by SIDE (BUY blue / SELL red); label colour by P&L.
      const sideColor = p.side.toUpperCase() === 'BUY' ? CHART_BUY_COLOR : CHART_SELL_COLOR;
      desired.push({
        key: p.id, price: entry, color: sideColor, textColor: pnlColor(pnl),
        // Text kept for the stale watchdog's book-keeping, but not shown on the
        // line (label:false) — the HTML overlay pill renders the P&L instead.
        text: `${p.side.toUpperCase()} ${lots} @ ${fp(entry)} | ${pnlStr} (${pctStr})`,
        dashed: false, pnl, label: false,
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

    const shapeOpts = (text: string, lineColor: string, textColor: string, dashed: boolean, showLabel = true) => ({
      shape: 'horizontal_line',
      text,
      lock: true, disableSelection: true, disableSave: true, disableUndo: true,
      overrides: {
        linecolor: lineColor, linestyle: dashed ? 2 : 0, linewidth: dashed ? 1 : 2,
        showLabel, textcolor: textColor, fontsize: 11, bold: true,
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
        const entry: any = { id: null, price: d.price, creating: true, text: d.text, color: d.color, textColor: d.textColor ?? d.color, pnl: d.pnl ?? null, propAt: now };
        linesRef.current.set(d.key, entry);
        chart.createShape({ time: t, price: d.price }, shapeOpts(d.label === false ? '' : d.text, d.color, d.textColor ?? d.color, d.dashed, d.label !== false))
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
        const nextTextColor = d.textColor ?? d.color;
        if (d.text !== existing.text || d.color !== existing.color || nextTextColor !== existing.textColor) {
          const isPnl = d.pnl != null;
          const throttleOk = !isPnl || (now - (existing.propAt || 0) >= throttleMs);
          // For entry lines the LINE colour is fixed by side, so the P&L flip
          // shows up in the LABEL colour — trigger on that too.
          const worthIt = !isPnl
            || d.color !== existing.color
            || nextTextColor !== existing.textColor
            || Math.abs((d.pnl as number) - (existing.pnl ?? 0)) > 0.01;
          if (throttleOk && worthIt) {
            try {
              chart.getShapeById(existing.id)?.setProperties({
                // Entry lines carry NO visible text — the HTML overlay pill is
                // their label (showLabel:false alone didn't suppress it in this
                // build, so keep the shape text empty too). (client 2026-07-09)
                text: d.label === false ? '' : d.text, linecolor: d.color, textcolor: nextTextColor,
              });
            } catch { /* keep last-known label on error */ }
            existing.text = d.text;
            existing.color = d.color;
            existing.textColor = nextTextColor;
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

  // Stale-price watchdog. The reconcile above only runs when `positions`
  // changes — i.e. on a tick — so if the feed stalls it simply STOPS and the
  // last P&L freezes silently. This 1s interval independently detects "no tick
  // for the selected symbol in > threshold" and greys the position entry lines
  // to "... | -- (stale)". Recovery is automatic: the next tick re-runs the
  // reconcile, which restores the live P&L label + colour. Hooks the EXISTING
  // store stream (no new subscription); cleans up on unmount / symbol switch.
  useEffect(() => {
    const w = widgetRef.current;
    if (!ready || !w?.activeChart) return;
    let chart: any;
    try { chart = w.activeChart(); } catch { return; }
    if (!chart?.getShapeById) return;
    const sym = (selectedSymbol || '').toUpperCase();
    const inst = useTradingStore.getState().instruments.find(
      (i) => String(i.symbol).toUpperCase() === sym,
    );
    const isCrypto = String(inst?.segment || '').toLowerCase() === 'crypto'
      || /BTC|ETH|USDT|XRP|SOL|LTC|DOGE|BNB/.test(sym);
    const day = new Date().getUTCDay(); // 0 Sun … 6 Sat
    const isWeekend = day === 0 || day === 6;
    const threshold = isCrypto
      ? STALE_MS.crypto
      : (isWeekend ? STALE_MS.weekendClosed : STALE_MS.normal);

    // Track last-tick receive time for THIS symbol via the existing store
    // stream. prices[sym] gets a fresh object reference on every tick.
    let lastPrice = useTradingStore.getState().prices[sym];
    let lastTickAt = Date.now();
    const unsub = useTradingStore.subscribe((state) => {
      const p = state.prices[sym];
      if (p !== lastPrice) { lastPrice = p; lastTickAt = Date.now(); }
    });

    let stale = false;
    const interval = setInterval(() => {
      const isStale = Date.now() - lastTickAt > threshold;
      if (isStale === stale) return;          // only act on a transition
      stale = isStale;
      if (!isStale) return;                    // recovery handled by the reconcile
      const now = Date.now();
      // (a) Position ENTRY lines (carry live P&L; entry.pnl != null). SL/TP and
      //     pending-order labels are static, so leave them untouched.
      for (const [, entry] of linesRef.current) {
        if (!entry || entry.id == null || entry.pnl == null) continue;
        // Entry lines have NO shape text (the overlay pill is the label); just
        // grey the LINE to signal stale — never write visible text back on it.
        try {
          chart.getShapeById(entry.id)?.setProperties({
            text: '', linecolor: STALE_COLOR, textcolor: STALE_COLOR,
          });
        } catch { /* noop */ }
        entry.color = STALE_COLOR;
        entry.textColor = STALE_COLOR;
        entry.propAt = now; // so the reconcile's throttle lets recovery through
      }
      // (b) Live BUY/SELL quote lines — grey them regardless of whether any
      //     position is open. The BUY/SELL effect restores them on the next
      //     fresh tick (it checks liveStaleRef).
      const live = liveLinesRef.current;
      if (live && typeof live === 'object' && live.ask != null) {
        // No text label on these lines — grey the colour (→ grey price pill) to
        // signal stale; the BUY/SELL effect restores blue/red on the next tick.
        try { chart.getShapeById(live.ask)?.setProperties({ linecolor: STALE_COLOR, textcolor: STALE_COLOR }); } catch { /* noop */ }
        try { chart.getShapeById(live.bid)?.setProperties({ linecolor: STALE_COLOR, textcolor: STALE_COLOR }); } catch { /* noop */ }
        liveStaleRef.current = true;
      }
    }, 1000);

    return () => { clearInterval(interval); try { unsub(); } catch { /* noop */ } };
  }, [ready, selectedSymbol]);

  // Live BUY / SELL price lines that track the current quote (MT4/MT5 style):
  // a blue BUY line at the ASK and a red SELL line at the BID (no text label —
  // colour signals side; the coloured price pill stays on the axis), updated on
  // every tick. Uses createShape('horizontal_line') — the CORE Charting Library API —
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

    // No BUY/SELL text label — the colour alone signals side (blue=BUY/ask,
    // red=SELL/bid), matching pro broker platforms. showPrice keeps the coloured
    // price pill on the right axis; showLabel:false drops the word. (2026-07-09)
    const opts = (color: string, vAlign: 'top' | 'bottom') => ({
      shape: 'horizontal_line',
      lock: true, disableSelection: true, disableSave: true, disableUndo: true,
      overrides: {
        linecolor: color, linestyle: 0, linewidth: 1,
        showLabel: false, showPrice: true, textcolor: color, fontsize: 11, bold: true,
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
        // Recovery: a fresh tick arrived after the stale watchdog greyed these
        // → restore the BUY (blue) / SELL (red) line colour, once.
        if (liveStaleRef.current) {
          liveStaleRef.current = false;
          try { chart.getShapeById(cur.ask)?.setProperties({ linecolor: CHART_BUY_COLOR, textcolor: CHART_BUY_COLOR }); } catch { /* noop */ }
          try { chart.getShapeById(cur.bid)?.setProperties({ linecolor: CHART_SELL_COLOR, textcolor: CHART_SELL_COLOR }); } catch { /* noop */ }
        }
        return;
      }
      // createShape is ASYNC (returns Promise<EntityId>) — await both, then
      // store the ids so later ticks just move the shapes.
      liveLinesRef.current = 'creating';
      Promise.all([
        chart.createShape({ time: t, price: tick.ask }, opts(CHART_BUY_COLOR, 'bottom')),
        chart.createShape({ time: t, price: tick.bid }, opts(CHART_SELL_COLOR, 'top')),
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

  // Stable key of the open positions on this symbol (id/side/lots) — changes
  // only when a position is opened/closed/resized, NOT on P&L ticks, so the
  // overlay effect below rebuilds its pills only when the SET changes and the
  // rAF loop owns all live updates.
  const symU = (selectedSymbol || '').toUpperCase();
  const positionsKey = positions
    .filter((p) => (p.symbol || '').toUpperCase() === symU)
    .map((p) => `${p.id}:${p.side}:${p.lots}`)
    .join('|');

  // ── Vantage-style HTML overlay labels for open-position entry lines. ────────
  // The TV shape label is a single text string, so the 3-section pill
  // (side badge | lots + P&L | close ✕) is rendered as absolutely-positioned
  // HTML synced to the entry price. This build has NO priceToCoordinate, so the
  // Y is derived from the main pane's getVisiblePriceRange + getHeight (linear
  // scale only); a requestAnimationFrame loop keeps it pinned through
  // scroll/zoom and refreshes the P&L text/colour (throttled to 500ms).
  useEffect(() => {
    const w = widgetRef.current;
    const overlay = overlayRef.current;
    if (!ready || !w?.activeChart || !overlay) return;
    let chart: any;
    try { chart = w.activeChart(); } catch { return; }
    if (!chart?.getPanes) return;

    const sym = (selectedSymbol || '').toUpperCase();
    const myPos = useTradingStore.getState().positions.filter(
      (p) => (p.symbol || '').toUpperCase() === sym,
    );

    // Read the main pane's linear price↔pixel geometry, or null if not mappable
    // (no pane / non-linear scale / no visible range).
    const geom = (): { top: number; bottom: number; h: number } | null => {
      try {
        const pane = chart.getPanes?.()[0];
        const ps = pane?.getMainSourcePriceScale?.();
        if (!ps || ps.getMode?.() !== 0) return null;   // linear (mode 0) only
        const range = ps.getVisiblePriceRange?.();
        const h = pane?.getHeight?.() || 0;
        if (!range || !(h > 0) || !(range.to > range.from)) return null;
        return { top: range.to, bottom: range.from, h };
      } catch { return null; }
    };
    const yForPrice = (price: number, g: { top: number; bottom: number; h: number }) =>
      (g.h * (g.top - price)) / (g.top - g.bottom);

    // Calibrate the container-relative offset (top toolbar height) from crosshair
    // events — offsetY is measured from the library container's top edge, so it
    // already includes the header the pane math omits. Constant until a resize,
    // which the next mouse move re-calibrates.
    const onCross = (params: any) => {
      const g = geom();
      if (!g || typeof params?.offsetY !== 'number' || typeof params?.price !== 'number') return;
      overlayOffsetRef.current = params.offsetY - yForPrice(params.price, g);
    };
    let crossSub: any = null;

    type Pill = {
      id: string; lots: number; entry: number;
      root: HTMLDivElement; info: HTMLSpanElement; close: HTMLButtonElement;
      lastText: string; lastColor: string; lastAt: number;
    };
    const pills: Pill[] = [];

    for (const p of myPos) {
      const side = String(p.side || '').toUpperCase();
      const sideColor = side === 'BUY' ? CHART_BUY_COLOR : CHART_SELL_COLOR;

      const root = document.createElement('div');
      root.style.cssText =
        `position:absolute;right:${PRICE_AXIS_W}px;display:flex;align-items:stretch;height:23px;`
        + `font-size:12px;line-height:1;white-space:nowrap;transform:translateY(-50%);`
        + `pointer-events:none;visibility:hidden;border-radius:4px;`
        + `box-shadow:0 2px 6px rgba(0,0,0,.5);z-index:5;`;

      const badge = document.createElement('span');
      badge.textContent = side;
      badge.style.cssText =
        `display:flex;align-items:center;padding:0 9px;color:#fff;background:${sideColor};`
        + `border-radius:4px 0 0 4px;font-weight:700;letter-spacing:.02em;`;

      // Solid dark chip so the P&L reads clearly over candles; coloured text
      // + a thin coloured border set by the sync loop.
      const info = document.createElement('span');
      info.style.cssText =
        `display:flex;align-items:center;padding:0 11px;font-weight:700;`
        + `background:${CHIP_BG};border-top:1px solid transparent;border-bottom:1px solid transparent;`;

      const close = document.createElement('button');
      close.type = 'button';
      close.textContent = '✕';
      close.title = 'Close position';
      close.style.cssText =
        `display:flex;align-items:center;padding:0 9px;border:0;cursor:pointer;`
        + `border-radius:0 4px 4px 0;font-weight:700;pointer-events:auto;background:${CHIP_BG};`;
      close.onmouseenter = () => { close.style.background = 'rgba(40,46,60,0.98)'; };
      close.onmouseleave = () => { close.style.background = CHIP_BG; };
      close.onclick = (e) => {
        e.stopPropagation();
        if (!window.confirm(`Close ${side} ${Number(p.lots)} ${sym} at market?`)) return;
        try { useTradingStore.getState().removePosition(p.id); } catch { /* noop */ }
        root.style.visibility = 'hidden';
        (async () => {
          try {
            const res = await api.post<any>(`/positions/${p.id}/close`, {}, { timeoutMs: 8000 });
            const pnl = Number(res?.profit ?? 0);
            toast.success(`Closed @ ${res?.close_price ?? ''} | P&L: ${pnl >= 0 ? '+' : '-'}$${Math.abs(pnl).toFixed(2)}`);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Close failed');
          } finally {
            Promise.all([
              useTradingStore.getState().refreshPositions(),
              useTradingStore.getState().refreshAccount(),
            ]).catch(() => {});
          }
        })();
      };

      root.appendChild(badge);
      root.appendChild(info);
      root.appendChild(close);
      overlay.appendChild(root);
      pills.push({
        id: p.id, lots: Number(p.lots) || 0, entry: Number(p.open_price) || 0,
        root, info, close, lastText: '', lastColor: '', lastAt: 0,
      });
    }

    if (pills.length === 0) return () => {};

    // Subscribe only when there are pills to place (avoids a leaked handler).
    try { crossSub = chart.crossHairMoved?.(); crossSub?.subscribe?.(null, onCross); } catch { /* noop */ }

    const THROTTLE = myPos.length >= 10 ? 1000 : 500;
    let raf = 0;
    const sync = () => {
      raf = requestAnimationFrame(sync);
      const g = geom();
      // No linear geometry (log/percent scale, or not ready) → hide, never
      // draw a mislocated pill.
      if (!g) { for (const pl of pills) pl.root.style.visibility = 'hidden'; return; }
      // Container-relative Y needs the top-toolbar offset added to the pane math.
      // Use the crosshair-calibrated value, else estimate from the height gap
      // until the first crosshair event lands.
      const containerH = containerRef.current?.clientHeight || g.h;
      // Exact once a crosshair event calibrates it (offsetY is container-relative
      // so it includes the top toolbar). Until then, estimate from the height
      // gap — getHeight() tends to include the time axis, so the gap ≈ the top
      // toolbar; don't over-subtract or the pill rides ABOVE the line.
      const offset = overlayOffsetRef.current ?? Math.max(0, containerH - g.h);
      const now = Date.now();
      const livePos = useTradingStore.getState().positions;
      for (const pl of pills) {
        const y = yForPrice(pl.entry, g) + offset;
        if (y < offset + 6 || y > offset + g.h - 6) { pl.root.style.visibility = 'hidden'; continue; }
        pl.root.style.top = `${y}px`;
        pl.root.style.visibility = 'visible';
        if (now - pl.lastAt < THROTTLE) continue;
        pl.lastAt = now;
        const p = livePos.find((x) => x.id === pl.id);
        const pnl = Number(p?.profit || 0);
        const color = Math.abs(pnl) < 0.10 ? BREAKEVEN_COLOR : pnl > 0 ? PROFIT_COLOR : LOSS_COLOR;
        const text = `${pl.lots.toFixed(2)}Lots ${pnl >= 0 ? '+' : '-'}${Math.abs(pnl).toFixed(2)}USD`;
        if (text === pl.lastText && color === pl.lastColor) continue;
        pl.info.textContent = text;
        pl.info.style.color = color;
        pl.info.style.borderTopColor = color;
        pl.info.style.borderBottomColor = color;
        pl.close.style.color = color;
        pl.lastText = text;
        pl.lastColor = color;
      }
    };
    raf = requestAnimationFrame(sync);

    return () => {
      cancelAnimationFrame(raf);
      try { crossSub?.unsubscribe?.(null, onCross); } catch { /* noop */ }
      for (const pl of pills) { try { overlay.removeChild(pl.root); } catch { /* noop */ } }
    };
  }, [ready, selectedSymbol, positionsKey]);

  return (
    <div className="relative w-full h-full min-h-[320px]">
      <div ref={containerRef} className="w-full h-full min-h-[320px]" />
      <div ref={overlayRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
    </div>
  );
}
