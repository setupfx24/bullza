'use client';

/**
 * AI Station — read-only Portfolio of the trades run on the pooled AI-Powered
 * Staking capital. Display only: these do NOT change the user's balance or the
 * guaranteed return; they show what the AI/desk traded on the locked capital.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { Loader2, Activity, LineChart } from 'lucide-react';
import api from '@/lib/api/client';

interface Trade {
  id: string; symbol: string; side: string; lots: number;
  entry_price: number; close_price: number | null;
  pnl: number | null; status: string; opened_at: string; closed_at: string | null;
}
interface Summary {
  open_count: number; closed_count: number; today_count: number;
  open_pnl: number; realized_pnl_month: number; realized_pnl_total: number;
  monthly_pnl: number; total_pnl: number;
}

const fmt = (n: number | null | undefined, d = 2) =>
  n === null || n === undefined ? '—' : Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const pnlCls = (n: number | null | undefined) =>
  (n ?? 0) > 0 ? 'text-buy' : (n ?? 0) < 0 ? 'text-red-400' : 'text-text-secondary';
const money = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${n >= 0 ? '+' : ''}$${fmt(n)}`);

export default function AiStationPortfolio() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'open' | 'closed'>('open');

  const load = useCallback(async (spinner = false) => {
    if (spinner) setLoading(true);
    try {
      const r = await api.get<{ trades: Trade[]; summary: Summary }>('/ai-station/my-trades');
      setTrades(r?.trades || []);
      setSummary(r?.summary || null);
    } catch {
      /* silent — feature may be disabled / no trades */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
    // Refresh open-trade P&L live.
    const t = setInterval(() => load(false), 5000);
    return () => clearInterval(t);
  }, [load]);

  // Always visible so the staker can see their Portfolio; fills in as trades
  // arrive (shows zeros / empty state until then).
  const s: Summary = summary ?? {
    open_count: 0, closed_count: 0, today_count: 0, open_pnl: 0,
    realized_pnl_month: 0, realized_pnl_total: 0, monthly_pnl: 0, total_pnl: 0,
  };
  const rows = trades.filter((t) => t.status === tab);

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Activity size={16} className="text-buy" />
        <h2 className="text-base font-semibold text-text-primary">Portfolio — AI trades</h2>
        <span className="text-xxs text-text-tertiary hidden sm:inline">live · display only, does not affect your guaranteed return</span>
        <Link
          href={`/ai-station/terminal?symbol=${trades[0]?.symbol || 'XAUUSD'}`}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-buy text-white hover:bg-buy/90 transition-fast"
        >
          <LineChart size={14} /> View Terminal
        </Link>
      </div>

      {loading && !summary ? (
        <div className="flex items-center justify-center h-24"><Loader2 className="animate-spin text-text-tertiary" size={18} /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-bg-secondary border border-border-primary rounded-lg p-4">
              <div className="text-xxs text-text-tertiary uppercase tracking-wide">This month P&L</div>
              <div className={clsx('text-2xl font-semibold tabular-nums mt-1', pnlCls(s.monthly_pnl))}>{money(s.monthly_pnl)}</div>
            </div>
            <div className="bg-bg-secondary border border-border-primary rounded-lg p-4">
              <div className="text-xxs text-text-tertiary uppercase tracking-wide">Total P&L</div>
              <div className={clsx('text-2xl font-semibold tabular-nums mt-1', pnlCls(s.total_pnl))}>{money(s.total_pnl)}</div>
            </div>
            <div className="bg-bg-secondary border border-border-primary rounded-lg p-4">
              <div className="text-xxs text-text-tertiary uppercase tracking-wide">Open trades</div>
              <div className="text-2xl font-semibold tabular-nums mt-1 text-text-primary">{s.open_count}</div>
              <div className={clsx('text-xs tabular-nums', pnlCls(s.open_pnl))}>{money(s.open_pnl)} running</div>
            </div>
            <div className="bg-bg-secondary border border-border-primary rounded-lg p-4">
              <div className="text-xxs text-text-tertiary uppercase tracking-wide">Today</div>
              <div className="text-2xl font-semibold tabular-nums mt-1 text-text-primary">{s.today_count}</div>
              <div className="text-xs text-text-tertiary">trades today</div>
            </div>
          </div>

          <div className="flex gap-1 mb-2">
            {(['open', 'closed'] as const).map((k) => (
              <button key={k} onClick={() => setTab(k)}
                className={clsx('px-3 py-1 text-xs rounded-md capitalize',
                  tab === k ? 'bg-buy/15 text-buy' : 'text-text-tertiary hover:text-text-secondary')}>
                {k} ({trades.filter((t) => t.status === k).length})
              </button>
            ))}
          </div>

          <div className="overflow-x-auto border border-border-primary rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary text-text-tertiary">
                <tr className="text-left">
                  {['Symbol', 'Side', 'Lots', 'Entry', tab === 'closed' ? 'Close' : 'Now', 'P&L', tab === 'closed' ? 'Closed' : 'Opened'].map((h) =>
                    <th key={h} className="px-3 py-2 text-xxs font-medium uppercase tracking-wide">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-t border-border-primary">
                    <td className="px-3 py-2 font-medium text-text-primary">{t.symbol}</td>
                    <td className={clsx('px-3 py-2 uppercase text-xs font-medium', t.side === 'buy' ? 'text-buy' : 'text-red-400')}>{t.side}</td>
                    <td className="px-3 py-2 tabular-nums text-text-secondary">{fmt(t.lots, 2)}</td>
                    <td className="px-3 py-2 tabular-nums text-text-secondary">{fmt(t.entry_price, 5)}</td>
                    <td className="px-3 py-2 tabular-nums text-text-secondary">{t.close_price === null ? '—' : fmt(t.close_price, 5)}</td>
                    <td className={clsx('px-3 py-2 tabular-nums font-medium', pnlCls(t.pnl))}>{money(t.pnl)}</td>
                    <td className="px-3 py-2 text-xxs text-text-tertiary whitespace-nowrap">
                      {new Date((tab === 'closed' ? t.closed_at : t.opened_at) || t.opened_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-text-tertiary text-xs">No {tab} trades.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
