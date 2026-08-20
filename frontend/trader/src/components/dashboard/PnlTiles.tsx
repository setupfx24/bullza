'use client';

import { TrendingDown, TrendingUp } from 'lucide-react';
import { PanelCard } from './PanelCard';

export interface PnlBreakdown {
  today: number;
  this_week: number;
  this_month: number;
  all_time: number;
}

const fmtUsd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
    .format(Number.isFinite(n) ? n : 0);

/**
 * P&L tiles — the EXISTING /portfolio/summary pnl_breakdown, shown as
 * the reference's stacked stat tiles ("Total income / Total paid").
 */
export function PnlTiles({ pnl }: { pnl: PnlBreakdown | null }) {
  const rows: Array<{ label: string; value: number | null }> = [
    { label: 'P&L today', value: pnl ? pnl.today : null },
    { label: 'P&L this week', value: pnl ? pnl.this_week : null },
    { label: 'P&L this month', value: pnl ? pnl.this_month : null },
    { label: 'P&L all time', value: pnl ? pnl.all_time : null },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 h-full">
      {rows.map(({ label, value }) => {
        const up = (value ?? 0) >= 0;
        const Icon = up ? TrendingUp : TrendingDown;
        return (
          <PanelCard key={label} padding="sm" className="flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-text-tertiary">
                {label}
              </span>
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{
                  background: up ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)',
                  color: up ? '#22c55e' : '#ef4444',
                }}
              >
                <Icon size={12} />
              </span>
            </div>
            <p
              className="mt-2 text-lg font-extrabold tabular-nums leading-none"
              style={{ color: value == null ? 'var(--text-tertiary)' : up ? '#22c55e' : '#ef4444' }}
            >
              {value == null ? '—' : `${value >= 0 ? '+' : ''}${fmtUsd(value)}`}
            </p>
          </PanelCard>
        );
      })}
    </div>
  );
}
