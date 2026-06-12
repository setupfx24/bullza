'use client';

/**
 * Super-admin Finance Overview.
 *
 * Headline cards for the whole company's money — each card is clickable
 * and opens a drill-down modal with its segregation (P&L by source,
 * deposits/withdrawals by method, credit split, fixed-return by tenure +
 * maturity schedule, pending by mode). Data: GET /analytics/finance-overview
 * (super_admin only). Per-USER drill-down is a follow-up phase.
 */
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, X, TrendingUp, ArrowDownCircle, ArrowUpCircle, Gift, Lock, Clock, ChevronRight } from 'lucide-react';
import { adminApi } from '@/lib/api';

interface Row { label?: string; method?: string; tenure?: string; month?: string; amount?: number; principal?: number; count?: number; key?: string }
interface Overview {
  net_pnl: { total: number; sources: Row[] };
  deposits: { total: number; by_method: Row[] };
  withdrawals: { total: number; by_method: Row[] };
  net_credit: { total: number; bonus: number; account_credit: number; insurance_credited_lifetime: number };
  fixed_return: { collected: number; interest_paid_to_date: number; projected_payable: number; by_tenure: Row[]; maturing: Row[] };
  pending_deposits: { total: number; by_method: Row[] };
  pending_withdrawals: { total: number; by_method: Row[] };
}

const fmt = (n: number | undefined) =>
  `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

type Drill = { title: string; render: () => React.ReactNode } | null;

export default function FinanceOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [drill, setDrill] = useState<Drill>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await adminApi.get<Overview>('/analytics/finance-overview');
      setData(d);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load finance overview');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-text-tertiary" size={22} /></div>;
  }
  if (!data) return null;

  // ── reusable breakdown table ──
  const methodTable = (rows: Row[], valKey: 'amount' | 'principal' = 'amount') => (
    <table className="w-full text-sm">
      <thead><tr className="text-text-tertiary text-xxs uppercase tracking-wide">
        <th className="text-left py-2">Method</th><th className="text-right py-2">Amount</th><th className="text-right py-2">Count</th>
      </tr></thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-text-tertiary text-xs">No data</td></tr>}
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-border-primary/50">
            <td className="py-2 text-text-primary capitalize">{(r.method || r.tenure || r.month || '—').replace(/_/g, ' ')}</td>
            <td className="py-2 text-right font-mono text-text-primary">{fmt(r[valKey])}</td>
            <td className="py-2 text-right text-text-tertiary">{r.count ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const cards: { title: string; value: number; sub?: string; icon: any; accent?: boolean; drill: Drill }[] = [
    {
      title: 'Net P&L (company)', value: data.net_pnl.total, icon: TrendingUp, accent: true,
      sub: 'Real profit to broker', drill: {
        title: 'Net P&L — by source',
        render: () => (
          <table className="w-full text-sm">
            <tbody>
              {data.net_pnl.sources.map((s, i) => (
                <tr key={i} className="border-t border-border-primary/50">
                  <td className="py-2 text-text-primary">{s.label}</td>
                  <td className={`py-2 text-right font-mono ${(s.amount ?? 0) >= 0 ? 'text-buy' : 'text-sell'}`}>
                    {(s.amount ?? 0) >= 0 ? '+' : '−'}{fmt(Math.abs(s.amount ?? 0))}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-border-primary font-bold">
                <td className="py-2 text-text-primary">Net P&L</td>
                <td className={`py-2 text-right font-mono ${data.net_pnl.total >= 0 ? 'text-buy' : 'text-sell'}`}>{fmt(data.net_pnl.total)}</td>
              </tr>
            </tbody>
          </table>
        ),
      },
    },
    {
      title: 'Net Deposits', value: data.deposits.total, icon: ArrowDownCircle,
      drill: { title: 'Deposits — by method', render: () => methodTable(data.deposits.by_method) },
    },
    {
      title: 'Net Withdrawals', value: data.withdrawals.total, icon: ArrowUpCircle,
      drill: { title: 'Withdrawals — by method', render: () => methodTable(data.withdrawals.by_method) },
    },
    {
      title: 'Net Credit (tradable)', value: data.net_credit.total, icon: Gift,
      sub: 'Bonus + insurance + grants', drill: {
        title: 'Net Credit — breakdown',
        render: () => (
          <table className="w-full text-sm"><tbody>
            <tr className="border-t border-border-primary/50"><td className="py-2 text-text-primary">Deposit bonus (wallet)</td><td className="py-2 text-right font-mono text-text-primary">{fmt(data.net_credit.bonus)}</td></tr>
            <tr className="border-t border-border-primary/50"><td className="py-2 text-text-primary">Account credit (bonus / insurance grants)</td><td className="py-2 text-right font-mono text-text-primary">{fmt(data.net_credit.account_credit)}</td></tr>
            <tr className="border-t border-border-primary/50"><td className="py-2 text-text-tertiary text-xs">Insurance credited (lifetime, ref)</td><td className="py-2 text-right font-mono text-text-tertiary text-xs">{fmt(data.net_credit.insurance_credited_lifetime)}</td></tr>
          </tbody></table>
        ),
      },
    },
    {
      title: 'Fixed Return collected', value: data.fixed_return.collected, icon: Lock,
      sub: `Payable: ${fmt(data.fixed_return.projected_payable)}`, drill: {
        title: 'Fixed Return — by tenure & maturity',
        render: () => (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><p className="text-xxs text-text-tertiary uppercase">Collected</p><p className="font-mono text-text-primary">{fmt(data.fixed_return.collected)}</p></div>
              <div><p className="text-xxs text-text-tertiary uppercase">Interest paid</p><p className="font-mono text-text-primary">{fmt(data.fixed_return.interest_paid_to_date)}</p></div>
              <div><p className="text-xxs text-text-tertiary uppercase">Projected payable</p><p className="font-mono text-amber-400">{fmt(data.fixed_return.projected_payable)}</p></div>
            </div>
            <div>
              <p className="text-xs font-semibold text-text-secondary mb-1">By tenure</p>
              {methodTable(data.fixed_return.by_tenure, 'principal')}
            </div>
            <div>
              <p className="text-xs font-semibold text-text-secondary mb-1">Maturing (by month)</p>
              {methodTable(data.fixed_return.maturing, 'principal')}
            </div>
          </div>
        ),
      },
    },
    {
      title: 'Pending Deposits', value: data.pending_deposits.total, icon: Clock,
      drill: { title: 'Pending deposits — by method', render: () => methodTable(data.pending_deposits.by_method) },
    },
    {
      title: 'Pending Withdrawals', value: data.pending_withdrawals.total, icon: Clock,
      drill: { title: 'Pending withdrawals — by method', render: () => methodTable(data.pending_withdrawals.by_method) },
    },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Finance Overview</h1>
          <p className="text-xxs text-text-tertiary mt-0.5">Company-wide real-time money. Click any card to drill down.</p>
        </div>
        <button onClick={load} className="text-xxs text-text-secondary border border-border-primary rounded-md px-3 py-1.5 hover:bg-bg-hover">Refresh</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.title}
              type="button"
              onClick={() => setDrill(c.drill)}
              className={`text-left rounded-xl border p-4 transition-colors hover:bg-bg-hover/40 ${c.accent ? 'border-accent/40 bg-accent/[0.04]' : 'border-border-primary bg-bg-secondary'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xxs text-text-tertiary uppercase tracking-wide">{c.title}</span>
                <Icon size={15} className={c.accent ? 'text-accent' : 'text-text-tertiary'} />
              </div>
              <p className={`mt-2 text-2xl font-bold font-mono ${c.accent ? (c.value >= 0 ? 'text-buy' : 'text-sell') : 'text-text-primary'}`}>{fmt(c.value)}</p>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xxs text-text-tertiary">{c.sub || ''}</span>
                <span className="inline-flex items-center gap-0.5 text-xxs text-accent">Details <ChevronRight size={11} /></span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Drill-down modal */}
      {drill && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrill(null)} />
          <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto bg-bg-secondary border border-border-primary rounded-xl shadow-modal">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border-primary sticky top-0 bg-bg-secondary">
              <h2 className="text-sm font-bold text-text-primary">{drill.title}</h2>
              <button onClick={() => setDrill(null)} className="p-1.5 rounded-md text-text-tertiary hover:bg-bg-hover hover:text-text-primary"><X size={16} /></button>
            </div>
            <div className="p-5">{drill.render()}</div>
          </div>
        </div>
      )}
    </div>
  );
}
