'use client';

/**
 * AI Station Terminal — a READ-ONLY, terminal-style view of the AI trades run
 * on the user's locked staking capital: a live chart with entry/exit markers,
 * P&L / return stat boxes, and open/closed trade tables. The user can only look
 * — there is no order panel, no close, no SL/TP, nothing to modify.
 */
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { clsx } from 'clsx';
import { ArrowLeft, Activity, Loader2, Lock } from 'lucide-react';
import api from '@/lib/api/client';
import type { AiTrade } from '@/components/charts/AiStationChart';

const AiStationChart = dynamic(() => import('@/components/charts/AiStationChart'), { ssr: false });

interface Trade {
  id: string; symbol: string; side: 'buy' | 'sell'; lots: number;
  entry_price: number; close_price: number | null;
  pnl: number | null; status: 'open' | 'closed';
  opened_at: string; closed_at: string | null;
}
interface Summary {
  open_count: number; closed_count: number; today_count: number; monthly_trades: number;
  open_pnl: number; monthly_pnl: number; total_pnl: number;
  monthly_pnl_pct: number; total_pnl_pct: number; principal: number;
}

const fmt = (n: number | null | undefined, d = 2) =>
  n === null || n === undefined ? '—' : Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const money = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${n >= 0 ? '+' : ''}$${fmt(n)}`);
const pct = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${n >= 0 ? '+' : ''}${fmt(n)}%`);
const pnlCls = (n: number | null | undefined) => ((n ?? 0) > 0 ? 'text-buy' : (n ?? 0) < 0 ? 'text-red-400' : 'text-text-secondary');

function TerminalInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [symbol, setSymbol] = useState((params.get('symbol') || 'XAUUSD').toUpperCase());
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ trades: Trade[]; summary: Summary }>('/ai-station/my-trades');
      setTrades(r?.trades || []);
      setSummary(r?.summary || null);
    } catch { /* silent */ } finally { setLoaded(true); }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, [load]);

  // Distinct symbols the user actually has trades on (for the switcher).
  const symbols = useMemo(() => {
    const set = new Set(trades.map((t) => t.symbol.toUpperCase()));
    set.add(symbol);
    return Array.from(set).sort();
  }, [trades, symbol]);

  const symTrades = useMemo(() => trades.filter((t) => t.symbol.toUpperCase() === symbol), [trades, symbol]);

  const chartTrades: AiTrade[] = useMemo(() => symTrades
    .filter((t) => t.opened_at)
    .map((t) => ({
      side: t.side,
      status: t.status,
      entryTime: Math.floor(new Date(t.opened_at).getTime() / 1000),
      entryPrice: t.entry_price,
      exitTime: t.closed_at ? Math.floor(new Date(t.closed_at).getTime() / 1000) : null,
      exitPrice: t.close_price,
      entryText: `${t.side.toUpperCase()} ${fmt(t.lots)} @ ${t.entry_price}`,
      exitText: `exit @ ${t.close_price} (${money(t.pnl)})`,
    })), [symTrades]);

  const rows = symTrades.filter((t) => t.status === tab);
  const s = summary;

  const Box = ({ label, main, sub, cls }: { label: string; main: string; sub?: string; cls?: string }) => (
    <div className="bg-bg-secondary border border-border-primary rounded-lg px-3 py-2">
      <div className="text-[10px] text-text-tertiary uppercase tracking-wide truncate">{label}</div>
      <div className={clsx('text-lg sm:text-xl font-semibold tabular-nums leading-tight', cls)}>{main}</div>
      {sub && <div className="text-[10px] text-text-tertiary tabular-nums">{sub}</div>}
    </div>
  );

  return (
    <div className="flex flex-col h-[100dvh] bg-bg-primary text-text-primary overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 h-14 border-b border-border-primary shrink-0">
        <button onClick={() => router.push('/fixed-return')} className="p-1.5 rounded-md hover:bg-bg-hover text-text-secondary" aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <Activity size={18} className="text-buy shrink-0" />
        <span className="font-semibold text-sm sm:text-base truncate">AI Station Terminal</span>
        <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/30">
          <Lock size={10} /> READ ONLY
        </span>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-[10px] text-text-tertiary hidden sm:inline">Instrument</label>
          <select value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="px-2 py-1.5 text-sm bg-bg-input border border-border-primary rounded-md text-text-primary">
            {symbols.map((sy) => <option key={sy} value={sy}>{sy}</option>)}
          </select>
        </div>
      </header>

      {/* Stat boxes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 p-2 sm:p-3 shrink-0">
        <Box label="This month P&L" main={money(s?.monthly_pnl ?? 0)} sub={`return ${pct(s?.monthly_pnl_pct ?? 0)}`} cls={pnlCls(s?.monthly_pnl)} />
        <Box label="Total P&L" main={money(s?.total_pnl ?? 0)} sub={`return ${pct(s?.total_pnl_pct ?? 0)}`} cls={pnlCls(s?.total_pnl)} />
        <Box label="Open (running)" main={String(s?.open_count ?? 0)} sub={`${money(s?.open_pnl ?? 0)} running`} cls="text-text-primary" />
        <Box label="Trades today" main={String(s?.today_count ?? 0)} cls="text-text-primary" />
        <Box label="Trades this month" main={String(s?.monthly_trades ?? 0)} cls="text-text-primary" />
      </div>

      {/* Chart + trades panel */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div className="h-[42vh] lg:h-auto lg:flex-1 min-h-0 border-b lg:border-b-0 lg:border-r border-border-primary">
          <AiStationChart symbol={symbol} trades={chartTrades} />
        </div>

        <div className="lg:w-[400px] shrink-0 flex flex-col min-h-0">
          <div className="flex items-center gap-1 px-3 pt-2 shrink-0">
            {(['open', 'closed'] as const).map((k) => (
              <button key={k} onClick={() => setTab(k)}
                className={clsx('px-3 py-1 text-xs rounded-md capitalize',
                  tab === k ? 'bg-buy/15 text-buy' : 'text-text-tertiary hover:text-text-secondary')}>
                {k} ({symTrades.filter((t) => t.status === k).length})
              </button>
            ))}
            <span className="ml-auto text-[10px] text-text-tertiary self-center">{symbol}</span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 pt-1">
            <table className="w-full text-xs">
              <thead className="text-text-tertiary sticky top-0 bg-bg-primary">
                <tr className="text-left">
                  {['Side', 'Lots', 'Entry', tab === 'closed' ? 'Close' : 'Now', 'P&L', tab === 'closed' ? 'Closed' : 'Opened'].map((h) =>
                    <th key={h} className="py-1.5 pr-2 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-t border-border-primary">
                    <td className={clsx('py-1.5 pr-2 uppercase font-medium', t.side === 'buy' ? 'text-buy' : 'text-red-400')}>{t.side}</td>
                    <td className="py-1.5 pr-2 tabular-nums text-text-secondary">{fmt(t.lots)}</td>
                    <td className="py-1.5 pr-2 tabular-nums text-text-secondary">{fmt(t.entry_price, 5)}</td>
                    <td className="py-1.5 pr-2 tabular-nums text-text-secondary">{t.close_price === null ? '—' : fmt(t.close_price, 5)}</td>
                    <td className={clsx('py-1.5 pr-2 tabular-nums font-medium', pnlCls(t.pnl))}>{money(t.pnl)}</td>
                    <td className="py-1.5 pr-2 text-[10px] text-text-tertiary whitespace-nowrap">
                      {new Date((tab === 'closed' ? t.closed_at : t.opened_at) || t.opened_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-text-tertiary">
                    {loaded ? `No ${tab} trades on ${symbol}.` : <Loader2 className="inline animate-spin" size={16} />}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AiStationTerminalPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[100dvh] bg-bg-primary"><Loader2 className="animate-spin text-text-tertiary" /></div>}>
      <TerminalInner />
    </Suspense>
  );
}
