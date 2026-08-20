'use client';

import { useEffect, useRef } from 'react';

/**
 * Live forex / metals / crypto ticker — TradingView ticker-tape widget.
 * Replaces the previous static marquee from data.LIVE_TICKER.
 */
export function LiveTickerBar() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    container.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [
        { proName: 'FX:EURUSD',         title: 'EUR/USD' },
        { proName: 'FX:GBPUSD',         title: 'GBP/USD' },
        { proName: 'FX:USDJPY',         title: 'USD/JPY' },
        { proName: 'FX:AUDUSD',         title: 'AUD/USD' },
        { proName: 'OANDA:XAUUSD',      title: 'Gold' },
        { proName: 'OANDA:XAGUSD',      title: 'Silver' },
        { proName: 'OANDA:US30USD',     title: 'US30' },
        { proName: 'OANDA:NAS100USD',   title: 'NAS100' },
        { proName: 'BINANCE:BTCUSDT',   title: 'BTC/USD' },
        { proName: 'BINANCE:ETHUSDT',   title: 'ETH/USD' },
        { proName: 'BINANCE:SOLUSDT',   title: 'SOL/USD' },
      ],
      showSymbolLogo: true,
      isTransparent: false,
      displayMode: 'adaptive',
      colorTheme: 'dark',
      locale: 'en',
      backgroundColor: 'rgba(10, 10, 10, 1)',
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, []);

  return (
    <div className="border-b border-border bg-background/80 backdrop-blur-sm">
      <div ref={containerRef} className="tradingview-widget-container w-full" />
    </div>
  );
}
