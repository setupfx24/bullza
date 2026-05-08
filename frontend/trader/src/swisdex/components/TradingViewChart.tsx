'use client';

import { useEffect, useRef } from 'react';

interface Props {
  symbol: string;
  height?: number | string;
}

export function TradingViewChart({ symbol, height = '100%' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';
    container.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: 'D',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      enable_publishing: false,
      hide_top_toolbar: false,
      hide_legend: false,
      hide_side_toolbar: true,
      hide_volume: false,
      allow_symbol_change: false,
      save_image: false,
      backgroundColor: 'rgba(10, 10, 10, 1)',
      gridColor: 'rgba(255, 255, 255, 0.06)',
      withdateranges: false,
      details: false,
      calendar: false,
      studies: [],
      toolbar_bg: 'rgba(10, 10, 10, 1)',
      support_host: 'https://www.tradingview.com',
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, [symbol]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container w-full"
      style={{ height }}
    />
  );
}
