'use client';

import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { Loader2, Lock, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

import DashboardShell from '@/components/layout/DashboardShell';
import api from '@/lib/api/client';

interface Tier { label: string; min_amount: number }
interface Tenure { label: string; days: number }
interface RateConfig {
  tiers: Tier[];
  tenures: Tenure[];
  rate_matrix_pct: number[][];
  early_withdrawal_fee_pct: number;
}

interface LockRow {
  id: string;
  principal: number;
  tier_label: string;
  tenure_label: string;
  tenure_days: number;
  rate_pct: number;
  locked_at: string | null;
  matures_at: string | null;
  settled_at: string | null;
  state: 'active' | 'matured' | 'withdrawn_early';
  payout: number | null;
  fee_paid: number | null;
  projected_payout: number;
}

const fmtUsd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

const fmtDate = (s: string | null) => {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString(); } catch { return s; }
};

const daysBetween = (a: string | null, b: Date) => {
  if (!a) return 0;
  return Math.max(0, Math.ceil((new Date(a).getTime() - b.getTime()) / 86_400_000));
};

export default function FixedReturnPage() {
  const [cfg, setCfg] = useState<RateConfig | null>(null);
  const [locks, setLocks] = useState<LockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>('1000');
  const [tenureLabel, setTenureLabel] = useState<string>('');

  const load = async () => {
    setLoading(true);
    try {
      const [c, l] = await Promise.all([
        api.get<RateConfig>('/fixed-return/config'),
        api.get<LockRow[]>('/fixed-return/locks').catch(() => [] as LockRow[]),
      ]);
      setCfg(c);
      setLocks(l || []);
      if (!tenureLabel && c.tenures.length > 0) setTenureLabel(c.tenures[0].label);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load Fixed Return');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const principal = useMemo(() => {
    const n = Number(amount);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [amount]);

  const tierIdx = useMemo(() => {
    if (!cfg) return -1;
    let idx = -1;
    cfg.tiers.forEach((t, i) => {
      if (principal >= t.min_amount) idx = i;
    });
    return idx;
  }, [cfg, principal]);

  const tenureIdx = useMemo(() => {
    if (!cfg) return -1;
    return cfg.tenures.findIndex((t) => t.label === tenureLabel);
  }, [cfg, tenureLabel]);

  const ratePct = useMemo(() => {
    if (!cfg || tierIdx < 0 || tenureIdx < 0) return 0;
    return cfg.rate_matrix_pct[tenureIdx]?.[tierIdx] ?? 0;
  }, [cfg, tierIdx, tenureIdx]);

  const projectedPayout = principal * (1 + ratePct / 100);
  const projectedGain = projectedPayout - principal;
  const minAmount = cfg?.tiers[0]?.min_amount ?? 0;
  const eligible = principal >= minAmount && tenureIdx >= 0;

  const submitLock = async () => {
    if (!cfg) return;
    if (!eligible) {
      toast.error(`Minimum lock amount is ${fmtUsd(minAmount)}`);
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/fixed-return/lock', { principal, tenure_label: tenureLabel });
      toast.success(`Locked ${fmtUsd(principal)} for ${tenureLabel}`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Lock failed');
    } finally {
      setSubmitting(false);
    }
  };

  const withdraw = async (l: LockRow) => {
    const now = Date.now();
    const matured = l.matures_at && new Date(l.matures_at).getTime() <= now;
    const msg = matured
      ? `Mature withdrawal — receive ${fmtUsd(l.projected_payout)} (${fmtUsd(l.principal)} + ${fmtUsd(l.projected_payout - l.principal)}). Continue?`
      : `Early withdrawal — ${cfg?.early_withdrawal_fee_pct ?? 0}% fee on principal, no return earned. Continue?`;
    if (!window.confirm(msg)) return;
    setWithdrawing(l.id);
    try {
      await api.post(`/fixed-return/locks/${l.id}/withdraw`, {});
      toast.success(matured ? 'Matured payout credited' : 'Funds returned (fee deducted)');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Withdrawal failed');
    } finally {
      setWithdrawing(null);
    }
  };

  if (loading || !cfg) {
    return (
      <DashboardShell>
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-accent" size={24} />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="px-6 py-6 space-y-6 max-w-[1200px] mx-auto">
        <header>
          <h1 className="text-2xl font-bold text-text-primary">Fixed Return</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Lock your principal for a defined tenure and earn a fixed return at maturity.
            Bigger deposits and longer lock-ups unlock higher rates.
          </p>
        </header>

        {/* Rate matrix */}
        <section className="rounded-xl border border-border-primary bg-bg-secondary overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border-primary bg-bg-tertiary/40">
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-text-tertiary">Tenure</th>
                {cfg.tiers.map((t, i) => (
                  <th
                    key={i}
                    className={clsx(
                      'px-4 py-3 text-center text-xs uppercase tracking-wide',
                      i === tierIdx ? 'text-accent font-semibold' : 'text-text-tertiary',
                    )}
                  >
                    {t.label}
                    <div className="text-[10px] font-normal text-text-tertiary/70 mt-0.5">
                      ≥ {fmtUsd(t.min_amount)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cfg.tenures.map((tn, ti) => (
                <tr
                  key={ti}
                  className={clsx(
                    'border-b border-border-primary/40',
                    tn.label === tenureLabel && 'bg-accent/[0.05]',
                  )}
                >
                  <th scope="row" className="text-left px-4 py-3 font-medium text-text-primary">
                    {tn.label}
                    <div className="text-[10px] font-normal text-text-tertiary mt-0.5">{tn.days} days</div>
                  </th>
                  {cfg.tiers.map((_, ci) => {
                    const highlight = ti === tenureIdx && ci === tierIdx;
                    return (
                      <td
                        key={ci}
                        className={clsx(
                          'px-4 py-3 text-center font-mono tabular-nums',
                          highlight
                            ? 'text-accent font-bold bg-accent/10'
                            : 'text-text-secondary',
                        )}
                      >
                        {(cfg.rate_matrix_pct[ti]?.[ci] ?? 0).toFixed(2)}%
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Calculator + lock form */}
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-3">Open a new lock</h2>
            <label className="block text-xs font-medium text-text-secondary mb-1">Principal (USD)</label>
            <input
              type="number"
              min={0}
              step={100}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg-input border border-border-primary rounded-md font-mono tabular-nums text-text-primary"
            />
            <label className="block text-xs font-medium text-text-secondary mb-1 mt-3">Tenure</label>
            <select
              value={tenureLabel}
              onChange={(e) => setTenureLabel(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg-input border border-border-primary rounded-md text-text-primary"
            >
              {cfg.tenures.map((t) => (
                <option key={t.label} value={t.label}>{t.label} ({t.days} days)</option>
              ))}
            </select>

            <button
              onClick={submitLock}
              disabled={submitting || !eligible}
              className="mt-4 inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-accent text-white font-semibold rounded-md hover:bg-accent/90 disabled:opacity-50 transition-fast"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Lock size={14} />}
              Lock {fmtUsd(principal || 0)}
            </button>
            {!eligible && principal > 0 && (
              <p className="mt-2 text-[11px] text-amber-400 flex items-center gap-1">
                <AlertTriangle size={11} /> Minimum lock amount is {fmtUsd(minAmount)}.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-3">Projected return</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md bg-bg-tertiary/40 p-3">
                <div className="text-[11px] text-text-tertiary uppercase">Tier</div>
                <div className="font-mono tabular-nums text-text-primary mt-1">
                  {tierIdx >= 0 ? cfg.tiers[tierIdx].label : '—'}
                </div>
              </div>
              <div className="rounded-md bg-bg-tertiary/40 p-3">
                <div className="text-[11px] text-text-tertiary uppercase">Rate</div>
                <div className="font-mono tabular-nums text-accent mt-1">{ratePct.toFixed(2)}%</div>
              </div>
              <div className="rounded-md bg-bg-tertiary/40 p-3">
                <div className="text-[11px] text-text-tertiary uppercase">Gain at maturity</div>
                <div className="font-mono tabular-nums text-buy mt-1">
                  {fmtUsd(eligible ? projectedGain : 0)}
                </div>
              </div>
              <div className="rounded-md bg-bg-tertiary/40 p-3">
                <div className="text-[11px] text-text-tertiary uppercase">Total payout</div>
                <div className="font-mono tabular-nums text-text-primary font-semibold mt-1">
                  {fmtUsd(eligible ? projectedPayout : 0)}
                </div>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-text-tertiary">
              Early withdrawal incurs a <strong className="text-text-secondary">{cfg.early_withdrawal_fee_pct}% fee</strong> on
              principal and forfeits the return earned to date.
            </p>
          </div>
        </section>

        {/* Active + history */}
        <section>
          <h2 className="text-sm font-semibold text-text-primary mb-3">Your locks</h2>
          {locks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-primary p-10 text-center text-sm text-text-tertiary">
              No locks yet. Open one above to start earning fixed returns.
            </div>
          ) : (
            <div className="space-y-2">
              {locks.map((l) => {
                const now = new Date();
                const matured = l.matures_at && new Date(l.matures_at) <= now;
                const isActive = l.state === 'active';
                return (
                  <div
                    key={l.id}
                    className="rounded-xl border border-border-primary bg-bg-secondary p-4 flex flex-wrap items-center gap-4"
                  >
                    <div className="min-w-[120px]">
                      <div className="text-xs text-text-tertiary uppercase">Principal</div>
                      <div className="font-mono tabular-nums text-text-primary font-semibold">
                        {fmtUsd(l.principal)}
                      </div>
                    </div>
                    <div className="min-w-[100px]">
                      <div className="text-xs text-text-tertiary uppercase">Tenure</div>
                      <div className="text-text-primary">{l.tenure_label}</div>
                    </div>
                    <div className="min-w-[80px]">
                      <div className="text-xs text-text-tertiary uppercase">Rate</div>
                      <div className="font-mono tabular-nums text-accent">{l.rate_pct.toFixed(2)}%</div>
                    </div>
                    <div className="min-w-[120px]">
                      <div className="text-xs text-text-tertiary uppercase">Matures</div>
                      <div className="text-text-primary text-sm flex items-center gap-1">
                        <Clock size={11} className="text-text-tertiary" />
                        {fmtDate(l.matures_at)}
                        {isActive && l.matures_at && !matured && (
                          <span className="text-[10px] text-text-tertiary ml-1">
                            ({daysBetween(l.matures_at, now)}d)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="min-w-[120px]">
                      <div className="text-xs text-text-tertiary uppercase">
                        {isActive ? 'Projected payout' : 'Payout'}
                      </div>
                      <div className="font-mono tabular-nums text-buy">
                        {fmtUsd(isActive ? l.projected_payout : (l.payout ?? 0))}
                      </div>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <span
                        className={clsx(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium',
                          isActive && !matured && 'bg-amber-500/10 text-amber-400',
                          isActive && matured && 'bg-buy/15 text-buy',
                          l.state === 'matured' && 'bg-buy/15 text-buy',
                          l.state === 'withdrawn_early' && 'bg-text-tertiary/10 text-text-tertiary',
                        )}
                      >
                        {isActive && matured && <CheckCircle2 size={11} />}
                        {l.state === 'matured' && <CheckCircle2 size={11} />}
                        {isActive ? (matured ? 'Matured' : 'Active') : l.state === 'matured' ? 'Settled' : 'Closed (early)'}
                      </span>
                      {isActive && (
                        <button
                          onClick={() => withdraw(l)}
                          disabled={withdrawing === l.id}
                          className={clsx(
                            'inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-fast',
                            matured
                              ? 'bg-buy text-white hover:bg-buy/90'
                              : 'border border-border-primary text-text-secondary hover:bg-bg-hover',
                          )}
                        >
                          {withdrawing === l.id && <Loader2 size={11} className="animate-spin" />}
                          {matured ? 'Withdraw' : 'Withdraw early'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
