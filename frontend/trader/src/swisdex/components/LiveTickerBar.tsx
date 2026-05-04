'use client';

import { LIVE_TICKER } from '../data';

export function LiveTickerBar() {
  const items = [...LIVE_TICKER, ...LIVE_TICKER];
  return (
    <div className="overflow-hidden border-b border-border bg-background/80 backdrop-blur-sm">
      <div
        className="flex w-max"
        style={{ animation: 'var(--animate-marquee)' }}
      >
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-6 py-2 border-r border-border shrink-0"
          >
            <span className="font-body text-xs font-medium text-foreground/90 tracking-wide">
              {item.pair}
            </span>
            <span className="font-display text-sm text-foreground tabular-nums">
              {item.price}
            </span>
            <span
              className="font-body text-xs font-medium tabular-nums"
              style={{ color: item.up ? '#55a630' : '#d00000' }}
            >
              {item.change}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
