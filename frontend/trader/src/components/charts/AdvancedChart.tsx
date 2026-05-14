'use client';

import { useEffect, useRef, memo, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { useTradingStore } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';
import { swisDexDatafeed } from '@/lib/charting/datafeed';
import { createBroker } from '@/lib/charting/broker';

/**
 * Loads the charting_library standalone script once, resolves when window.TradingView
 * is available.
 */
let scriptPromise: Promise<void> | null = null;
function loadChartingLib(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    if ((window as any).TradingView?.widget) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = '/charting_library/charting_library.standalone.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load charting library'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

function AdvancedChartInner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const pathname = usePathname();

  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useTradingStore((s) => s.setSelectedSymbol);
  const theme = useUIStore((s) => s.theme);

  const onTradingTerminal = Boolean(pathname?.startsWith('/trading/terminal'));
  const tvTheme = theme === 'light' ? 'light' : 'dark';
  const interval = onTradingTerminal ? '5' : '15';
  const symbol = selectedSymbol || 'XAUUSD';

  // Track what the widget was created with — only recreate on theme/interval change, NOT symbol
  const createdWithRef = useRef({ theme: '', interval: '' });
  const chartReadyRef = useRef(false);
  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;

  /** Create or recreate the widget (only on mount or theme change). */
  const createWidget = useCallback(async () => {
    if (!containerRef.current) return;

    // Skip recreation if only symbol changed — handled by setSymbol() below
    if (
      widgetRef.current &&
      createdWithRef.current.theme === tvTheme &&
      createdWithRef.current.interval === interval
    ) {
      return;
    }

    // Remove previous widget
    if (widgetRef.current) {
      try { widgetRef.current.remove(); } catch {}
      widgetRef.current = null;
      chartReadyRef.current = false;
    }

    await loadChartingLib();

    const TV = (window as any).TradingView;
    if (!TV?.widget || !containerRef.current) return;

    const w = new TV.widget({
      container: containerRef.current,
      locale: 'en',
      library_path: '/charting_library/',
      datafeed: swisDexDatafeed,
      symbol: symbolRef.current,
      interval,
      timezone: 'Etc/UTC',
      theme: tvTheme as 'dark' | 'light',
      fullscreen: false,
      autosize: true,
      debug: false,

      // Timeframe shortcuts surfaced on the chart toolbar (1D, 5D, 1M, …).
      // The resolutions returned by the datafeed (1, 5, 15, 30, 60, 240, D)
      // are what the interval picker exposes — `time_frames` adds the
      // higher-level "show me 1 day of intraday" / "show me 1 month" shortcuts
      // the client called out as missing.
      time_frames: [
        { text: '1D', resolution: '5',   description: '1 Day intraday (5m)' },
        { text: '5D', resolution: '15',  description: '5 Days (15m)' },
        { text: '1M', resolution: '60',  description: '1 Month (1H)' },
        { text: '3M', resolution: '240', description: '3 Months (4H)' },
        { text: '6M', resolution: '240', description: '6 Months (4H)' },
        { text: 'YTD', resolution: 'D',  description: 'Year-to-Date' },
        { text: '1Y', resolution: 'D',   description: '1 Year' },
        { text: 'ALL', resolution: 'D',  description: 'All available history' },
      ],

      // Trading Terminal — built-in order panel
      broker_factory: (host: any) => createBroker(host),

      disabled_features: [
        'use_localstorage_for_settings',
        'header_compare',
        'header_symbol_search',
        'display_market_status',
        'popup_hints',
        // Study templates require a save_load_adapter (or client_id +
        // user_id + backend routes at {library_path}{client_id}/{user_id}/
        // study_templates) to read/write. Without those TV emits a 404
        // on /charting_library/undefined/undefined/study_templates and
        // surfaces an unhandled promise rejection on every chart mount.
        // Re-enable once the SaveLoadAdapter is wired in broker.ts.
        'study_templates',
      ],
      enabled_features: [
        'side_toolbar_in_fullscreen_mode',
        'trading_notifications',
        'show_trading_notifications_history',
        'pinch_scale',
        'horz_touch_drag_scroll',
        'vert_touch_drag_scroll',
        // Surface TradingView's bell-icon "Add alert" button on the chart
        // toolbar. Without backend alert persistence (broker.ts has no
        // subscribePriceAlerts/createPriceAlert handlers wired) these are
        // ephemeral — kept in the browser session only and lost on reload.
        // Persistent alerts require a price_alerts DB table + evaluation
        // engine; tracked as a follow-up.
        'create_alert_button_on_chart',
        'price_alert_dialog',
      ],
      overrides: {
        'mainSeriesProperties.style': 1, // candles
        'mainSeriesProperties.candleStyle.upColor': '#26a69a',
        'mainSeriesProperties.candleStyle.downColor': '#ef5350',
        'mainSeriesProperties.candleStyle.borderUpColor': '#26a69a',
        'mainSeriesProperties.candleStyle.borderDownColor': '#ef5350',
        'mainSeriesProperties.candleStyle.wickUpColor': '#26a69a',
        'mainSeriesProperties.candleStyle.wickDownColor': '#ef5350',
        'paneProperties.background': tvTheme === 'dark' ? '#0d0d0d' : '#ffffff',
        'paneProperties.backgroundType': 'solid',
        'scalesProperties.textColor': tvTheme === 'dark' ? '#aaaaaa' : '#555555',
        'scalesProperties.backgroundColor': tvTheme === 'dark' ? '#0d0d0d' : '#ffffff',
        // ── Broker-integration line styling ─────────────────────────────
        // Position entry, SL, TP lines come from the broker adapter. Default
        // TV styling makes them nearly invisible on the dark theme; the
        // client flagged "Execution / SL / TP nothing showing". These
        // overrides bump line width + use brand-friendly colors that pop
        // against the chart background.
        'tradingProperties.lineLength': 80,
        'tradingProperties.linewidth': 2,
        'tradingProperties.showPositionsInChart': true,
        'tradingProperties.showOrdersInChart': true,
        'tradingProperties.showExecutionsInChart': true,
        'tradingProperties.horizontalAlignment': 'right',
        // Entry line — SwisDex green for buys, red for sells (TV handles
        // direction per-position so we set both buy/sell tints here).
        'tradingProperties.positionPL.plValueColor': '#9a9a9a',
        'tradingProperties.position.buyColor': '#55a630',
        'tradingProperties.position.sellColor': '#ef5350',
        'tradingProperties.position.linestyle': 0,    // solid
        'tradingProperties.position.linewidth': 2,
        // SL line — amber.
        'tradingProperties.stopLoss.buyColor': '#f59e0b',
        'tradingProperties.stopLoss.sellColor': '#f59e0b',
        'tradingProperties.stopLoss.linestyle': 2,    // dashed
        'tradingProperties.stopLoss.linewidth': 2,
        // TP line — bright green.
        'tradingProperties.takeProfit.buyColor': '#22c55e',
        'tradingProperties.takeProfit.sellColor': '#22c55e',
        'tradingProperties.takeProfit.linestyle': 2,  // dashed
        'tradingProperties.takeProfit.linewidth': 2,
      },
      loading_screen: {
        backgroundColor: tvTheme === 'dark' ? '#0e0e0e' : '#f2efe9',
        foregroundColor: tvTheme === 'dark' ? '#2962FF' : '#2962FF',
      },
    });

    widgetRef.current = w;
    createdWithRef.current = { theme: tvTheme, interval };

    // Listen for symbol changes from within the chart
    w.onChartReady(() => {
      chartReadyRef.current = true;
      w.activeChart().onSymbolChanged().subscribe(null, () => {
        const newSym = w.activeChart().symbol();
        if (newSym) {
          const cleaned = newSym.includes(':') ? newSym.split(':').pop()! : newSym;
          if (cleaned.toUpperCase() !== (selectedSymbol || '').toUpperCase()) {
            setSelectedSymbol(cleaned.toUpperCase());
          }
        }
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tvTheme, interval, setSelectedSymbol]);

  // Mount / recreate only on theme or interval change
  useEffect(() => {
    createWidget();
    return () => {
      if (widgetRef.current) {
        try { widgetRef.current.remove(); } catch {}
        widgetRef.current = null;
        chartReadyRef.current = false;
      }
    };
  }, [createWidget]);

  // Fast symbol switch — just call setSymbol(), no widget recreation
  const prevSymbolRef = useRef(symbol);
  useEffect(() => {
    if (symbol !== prevSymbolRef.current) {
      prevSymbolRef.current = symbol;
      const w = widgetRef.current;
      if (w && chartReadyRef.current) {
        try {
          const current = w.activeChart().symbol();
          const currentClean = current?.includes(':') ? current.split(':').pop() : current;
          if ((currentClean || '').toUpperCase() !== symbol.toUpperCase()) {
            w.activeChart().setSymbol(symbol);
          }
        } catch {}
      } else if (w) {
        // Widget exists but not ready yet — wait for it
        w.onChartReady(() => {
          chartReadyRef.current = true;
          try { w.activeChart().setSymbol(symbol); } catch {}
        });
      }
    }
  }, [symbol]);

  const surface = tvTheme === 'light' ? 'bg-bg-base' : 'bg-[#0e0e0e]';

  return (
    <div
      ref={containerRef}
      className={clsx('w-full h-full min-h-[200px] min-w-0', surface)}
      style={{ touchAction: 'none' }}
      onWheel={(e) => e.stopPropagation()}
      data-tv-chart-root
    />
  );
}

export default memo(AdvancedChartInner);
