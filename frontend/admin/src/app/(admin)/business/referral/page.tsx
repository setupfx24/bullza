'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Loader2, Save, RefreshCw, Users, DollarSign, Award, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

interface TopReferrer { user_id: string; name: string; email: string; earned: number; payouts: number }
interface Payout {
  id: string;
  referrer_user_id: string;
  referrer_email: string;
  amount: number;
  description: string;
  deposit_id: string | null;
  created_at: string | null;
}
interface Overview {
  commission_pct: number;
  total_paid: number;
  total_payouts: number;
  total_referred_users: number;
  top_referrers: TopReferrer[];
  recent_payouts: {
    items: Payout[];
    page: number;
    per_page: number;
    total: number;
  };
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(s: string | null) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

export default function ReferralAdminPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pct, setPct] = useState<number>(5);
  const [savingPct, setSavingPct] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const d = await adminApi.get<Overview>('/business/referral/overview', { page: String(page), per_page: '20' });
      setData(d);
      setPct(d.commission_pct);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load referral overview');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const saveRate = async () => {
    if (pct < 0 || pct > 100) {
      toast.error('Commission % must be between 0 and 100');
      return;
    }
    setSavingPct(true);
    try {
      await adminApi.put('/settings', { settings: { referral_commission_pct: pct } });
      toast.success('Commission rate saved');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setSavingPct(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 size={20} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.recent_payouts.total / data.recent_payouts.per_page)) : 1;

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">User Referral Program</h1>
          <p className="text-xxs text-text-tertiary mt-0.5">
            Personal referral commission paid on a referred user&apos;s first approved deposit.
            Separate from the IB MLM program.
          </p>
        </div>
        <button
          onClick={load}
          disabled={refreshing}
          className="p-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover transition-fast disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Commission rate */}
      <div className="bg-bg-secondary border border-border-primary rounded-md p-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-text-primary">Commission rate</h2>
          <p className="text-xxs text-text-tertiary mt-0.5">
            % of the referred user&apos;s first approved deposit credited to the referrer&apos;s main wallet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={pct}
            onChange={(e) => setPct(parseFloat(e.target.value) || 0)}
            className="w-24 text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md font-mono tabular-nums text-right text-text-primary"
          />
          <span className="text-xs text-text-tertiary">%</span>
          <button
            onClick={saveRate}
            disabled={savingPct}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-buy hover:bg-buy-light disabled:opacity-50"
          >
            {savingPct ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard icon={<DollarSign size={14} />} label="Total paid" value={`$${fmt(data?.total_paid || 0)}`} color="text-buy" />
        <StatCard icon={<Award size={14} />} label="Payouts" value={String(data?.total_payouts || 0)} color="text-accent" />
        <StatCard icon={<Users size={14} />} label="Referred users" value={String(data?.total_referred_users || 0)} color="text-text-primary" />
      </div>

      {/* Top referrers */}
      <div className="bg-bg-secondary border border-border-primary rounded-md">
        <div className="px-4 py-3 border-b border-border-primary">
          <h2 className="text-sm font-medium text-text-primary">Top referrers</h2>
        </div>
        <div className="overflow-x-auto">
          {(!data || data.top_referrers.length === 0) ? (
            <div className="px-4 py-8 text-center text-xs text-text-tertiary">No referrals yet.</div>
          ) : (
            <table className="w-full min-w-[480px]">
              <thead>
                <tr className="border-b border-border-primary bg-bg-tertiary/40">
                  <th className="text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Referrer</th>
                  <th className="text-right px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Earned</th>
                  <th className="text-right px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Payouts</th>
                </tr>
              </thead>
              <tbody>
                {data.top_referrers.map((r) => (
                  <tr key={r.user_id} className="border-b border-border-primary/50 last:border-0 hover:bg-bg-hover/30">
                    <td className="px-4 py-2.5">
                      <div className="text-xs text-text-primary truncate max-w-[260px]">{r.name || '—'}</div>
                      <div className="text-xxs text-text-tertiary truncate max-w-[260px]">{r.email}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs font-mono tabular-nums text-buy">${fmt(r.earned)}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-mono tabular-nums text-text-secondary">{r.payouts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Recent payouts */}
      <div className="bg-bg-secondary border border-border-primary rounded-md">
        <div className="px-4 py-3 border-b border-border-primary flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-medium text-text-primary flex-1">Recent payouts</h2>
          {data && data.recent_payouts.total > 0 && (
            <div className="flex items-center gap-2 text-xxs text-text-tertiary">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1 rounded border border-border-primary disabled:opacity-30 hover:bg-bg-hover"
              >
                <ChevronLeft size={12} />
              </button>
              <span className="tabular-nums">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1 rounded border border-border-primary disabled:opacity-30 hover:bg-bg-hover"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          {(!data || data.recent_payouts.items.length === 0) ? (
            <div className="px-4 py-8 text-center text-xs text-text-tertiary">No payouts yet.</div>
          ) : (
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-border-primary bg-bg-tertiary/40">
                  <th className="text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide">When</th>
                  <th className="text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Referrer</th>
                  <th className="text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Description</th>
                  <th className="text-right px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_payouts.items.map((p) => (
                  <tr key={p.id} className="border-b border-border-primary/50 last:border-0 hover:bg-bg-hover/30">
                    <td className="px-4 py-2.5 text-xxs text-text-secondary whitespace-nowrap">{fmtDate(p.created_at)}</td>
                    <td className="px-4 py-2.5 text-xs text-text-primary truncate max-w-[200px]">{p.referrer_email}</td>
                    <td className="px-4 py-2.5 text-xxs text-text-tertiary max-w-[320px] truncate">{p.description}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-mono tabular-nums text-buy">${fmt(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-bg-secondary border border-border-primary rounded-md p-4">
      <div className="flex items-center gap-2 text-xxs text-text-tertiary uppercase">
        {icon} {label}
      </div>
      <p className={`text-lg font-bold font-mono tabular-nums mt-1 ${color}`}>{value}</p>
    </div>
  );
}
