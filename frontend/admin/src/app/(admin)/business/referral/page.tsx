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
  /** Legacy % — no longer read by the engine; kept for old clients. */
  commission_pct: number;
  /** Flat USD paid per qualified claim. */
  bounty_usd: number;
  /** Closed trades a friend must make before they qualify. */
  qualifying_trades: number;
  requires_kyc: boolean;
  requires_funded: boolean;
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

  // Editable gate config — mirrors the trader engine's actual inputs:
  // referral_commission_amount_usd, referral_qualifying_trades,
  // referral_requires_kyc, referral_requires_funded.
  const [bountyUsd, setBountyUsd] = useState<number>(5);
  const [qualifyingTrades, setQualifyingTrades] = useState<number>(3);
  const [requiresKyc, setRequiresKyc] = useState<boolean>(true);
  const [requiresFunded, setRequiresFunded] = useState<boolean>(true);
  const [savingRules, setSavingRules] = useState(false);

  // Referral tier ladder — SEPARATE from the IB ladder. Rows of
  // {min_referrals, max_referrals|null, per_referral_bounty}.
  type RefTier = { min_referrals: number; max_referrals: number | null; per_referral_bounty: number };
  const [tiers, setTiers] = useState<RefTier[]>([]);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const d = await adminApi.get<Overview>('/business/referral/overview', { page: String(page), per_page: '20' });
      setData(d);
      setBountyUsd(d.bounty_usd ?? 5);
      setQualifyingTrades(d.qualifying_trades ?? 3);
      setRequiresKyc(d.requires_kyc ?? true);
      setRequiresFunded(d.requires_funded ?? true);
      // Load the dedicated referral tier ladder from settings.
      try {
        const settings = await adminApi.get<{ key: string; value: any }[]>('/settings');
        const row = Array.isArray(settings) ? settings.find((s) => s.key === 'referral_tiers') : null;
        const raw = row?.value;
        setTiers(Array.isArray(raw) ? raw.map((r: any) => ({
          min_referrals: Number(r.min_referrals) || 0,
          max_referrals: r.max_referrals == null || r.max_referrals === '' ? null : Number(r.max_referrals),
          per_referral_bounty: Number(r.per_referral_bounty) || 0,
        })) : []);
      } catch { /* settings optional */ }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load referral overview');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const saveRules = async () => {
    if (bountyUsd < 0) {
      toast.error('Bounty must be ≥ 0');
      return;
    }
    if (qualifyingTrades < 1) {
      toast.error('Qualifying trades must be ≥ 1');
      return;
    }
    setSavingRules(true);
    try {
      // Clean + sort the tier ladder before saving.
      const cleanTiers = tiers
        .map((t) => ({
          min_referrals: Math.max(0, Math.floor(t.min_referrals || 0)),
          max_referrals: t.max_referrals == null ? null : Math.max(0, Math.floor(t.max_referrals)),
          per_referral_bounty: Math.max(0, Number(t.per_referral_bounty) || 0),
        }))
        .sort((a, b) => a.min_referrals - b.min_referrals);
      await adminApi.put('/settings', {
        settings: {
          referral_commission_amount_usd: bountyUsd,
          referral_qualifying_trades: qualifyingTrades,
          referral_requires_kyc: requiresKyc,
          referral_requires_funded: requiresFunded,
          referral_tiers: cleanTiers,
        },
      });
      toast.success('Referral rules saved');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setSavingRules(false);
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

      {/* Qualifying rules — replaces the legacy % rate, since the engine
          now pays a flat USD bounty only after the friend clears the
          KYC / first-deposit / N-trades gates. The actual per-referral
          payout is decided by the tier ladder (1–20 / 21–100 / 101+) on
          /config/ib-tiers; the bounty input below is only the fallback. */}
      <div className="bg-bg-secondary border border-border-primary rounded-md p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-text-primary">Qualifying rules</h2>
            <p className="text-xxs text-text-tertiary mt-0.5">
              Gates the engine enforces before a referrer can press Claim. The per-referral
              payout comes from the <span className="text-text-primary font-semibold">Referral tier ladder</span>{' '}
              below (its OWN ladder, separate from the IB program — by the referrer's claimed
              referral count); the fallback bounty applies only when no tier matches.
            </p>
          </div>
          <button
            onClick={saveRules}
            disabled={savingRules}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-buy hover:bg-buy-light disabled:opacity-50 shrink-0"
          >
            {savingRules ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Bounty USD — fallback only */}
          <label className="flex flex-col gap-1">
            <span className="text-xxs text-text-tertiary uppercase tracking-wide">Fallback bounty (no matching tier)</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-tertiary">$</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={bountyUsd}
                onChange={(e) => setBountyUsd(parseFloat(e.target.value) || 0)}
                className="w-32 text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md font-mono tabular-nums text-right text-text-primary"
              />
              <span className="text-xxs text-text-tertiary">USD</span>
            </div>
          </label>

          {/* Qualifying trades */}
          <label className="flex flex-col gap-1">
            <span className="text-xxs text-text-tertiary uppercase tracking-wide">Closed trades to qualify</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                step={1}
                value={qualifyingTrades}
                onChange={(e) => setQualifyingTrades(parseInt(e.target.value, 10) || 1)}
                className="w-24 text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md font-mono tabular-nums text-right text-text-primary"
              />
              <span className="text-xxs text-text-tertiary">trades</span>
            </div>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={requiresKyc}
              onChange={(e) => setRequiresKyc(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-buy cursor-pointer"
            />
            <span className="text-xs text-text-primary">
              Require friend's KYC to be approved
              <span className="block text-xxs text-text-tertiary">
                Off = pay even if friend is still pending verification.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={requiresFunded}
              onChange={(e) => setRequiresFunded(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-buy cursor-pointer"
            />
            <span className="text-xs text-text-primary">
              Require friend's first approved deposit
              <span className="block text-xxs text-text-tertiary">
                Off = pay even on demo / unfunded sign-ups (not recommended).
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* Referral tier ladder — separate from IB. Pays per-referral by the
          referrer's claimed-referral count (1-indexed position). */}
      <div className="bg-bg-secondary border border-border-primary rounded-md p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-text-primary">Referral tier ladder</h2>
            <p className="text-xxs text-text-tertiary mt-0.5">
              Its own ladder (independent of the IB program). Each row = a referral-count band
              and the bounty paid per qualifying referral in that band. Leave the last row&apos;s
              &quot;to&quot; empty for &quot;and above&quot;. No matching row → fallback bounty above. Save with the button up top.
            </p>
          </div>
          <button
            onClick={() => setTiers((t) => [...t, { min_referrals: t.length ? (t[t.length - 1].max_referrals ?? t[t.length - 1].min_referrals) + 1 : 1, max_referrals: null, per_referral_bounty: 0 }])}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-buy border border-buy/40 hover:bg-buy/10 shrink-0"
          >
            + Add tier
          </button>
        </div>

        {tiers.length === 0 ? (
          <p className="text-xs text-text-tertiary">No tiers — every qualifying referral pays the fallback bounty. Add a tier to scale payouts by volume.</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xxs text-text-tertiary uppercase tracking-wide px-1">
              <span>From (referral #)</span><span>To (#, empty = +)</span><span>Bounty / referral ($)</span><span></span>
            </div>
            {tiers.map((t, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                <input type="number" min={0} value={t.min_referrals}
                  onChange={(e) => setTiers((arr) => arr.map((x, j) => j === i ? { ...x, min_referrals: parseInt(e.target.value, 10) || 0 } : x))}
                  className="text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md font-mono tabular-nums text-right text-text-primary" />
                <input type="number" min={0} value={t.max_referrals ?? ''} placeholder="∞"
                  onChange={(e) => setTiers((arr) => arr.map((x, j) => j === i ? { ...x, max_referrals: e.target.value === '' ? null : (parseInt(e.target.value, 10) || 0) } : x))}
                  className="text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md font-mono tabular-nums text-right text-text-primary" />
                <input type="number" min={0} step={0.5} value={t.per_referral_bounty}
                  onChange={(e) => setTiers((arr) => arr.map((x, j) => j === i ? { ...x, per_referral_bounty: parseFloat(e.target.value) || 0 } : x))}
                  className="text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md font-mono tabular-nums text-right text-text-primary" />
                <button onClick={() => setTiers((arr) => arr.filter((_, j) => j !== i))}
                  className="px-2 py-1 rounded-md text-xs text-sell border border-sell/30 hover:bg-sell/10">Remove</button>
              </div>
            ))}
          </div>
        )}
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
