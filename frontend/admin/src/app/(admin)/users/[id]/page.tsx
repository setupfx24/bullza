'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import Link from 'next/link';
import {
  ArrowLeft,
  Ban,
  CreditCard,
  DollarSign,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  Shield,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';

interface UserDetail {
  user: {
    id: string;
    email: string;
    phone: string | null;
    first_name: string | null;
    last_name: string | null;
    country: string | null;
    address: string | null;
    role: string;
    status: string;
    kyc_status: string;
    is_demo: boolean;
    created_at: string | null;
  };
  accounts: {
    id: string;
    account_number: string;
    balance: number;
    credit: number;
    equity: number;
    margin_used: number;
    free_margin: number;
    margin_level: number;
    leverage: number;
    currency: string;
    is_demo: boolean;
    is_active: boolean;
  }[];
  total_deposit: number;
  total_withdrawal: number;
  total_trades: number;
  open_positions: number;
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusColor(s: string) {
  switch (s?.toLowerCase()) {
    case 'active': return 'bg-success/15 text-success';
    case 'banned': case 'suspended': return 'bg-danger/15 text-danger';
    default: return 'bg-warning/15 text-warning';
  }
}

function kycColor(k: string) {
  switch (k?.toLowerCase()) {
    case 'verified': case 'approved': return 'bg-success/15 text-success';
    case 'pending': return 'bg-warning/15 text-warning';
    case 'rejected': return 'bg-danger/15 text-danger';
    default: return 'bg-text-tertiary/15 text-text-tertiary';
  }
}

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.get<UserDetail>(`/users/${userId}`);
      setData(res);
    } catch (e: any) {
      setError(e.message || 'Failed to load user');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center py-32">
          <Loader2 size={24} className="animate-spin text-text-tertiary" />
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <div className="p-6">
          <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-fast mb-4">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="text-center py-20 text-sm text-danger">{error || 'User not found'}</div>
        </div>
      </>
    );
  }

  const { user, accounts, total_deposit, total_withdrawal, total_trades, open_positions } = data;
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email.split('@')[0];

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Back + Header */}
        <div>
          <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-fast mb-4">
            <ArrowLeft size={16} /> Back to Users
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-buy/10 border-2 border-buy/20 flex items-center justify-center">
                <UserRound size={28} className="text-buy" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-text-primary">{name}</h1>
                <p className="text-sm text-text-tertiary">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold', statusColor(user.status))}>{user.status}</span>
              <span className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold', kycColor(user.kyc_status))}>KYC: {user.kyc_status}</span>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Deposits', value: `$${fmt(total_deposit)}`, icon: DollarSign, color: 'text-success' },
            { label: 'Total Withdrawals', value: `$${fmt(total_withdrawal)}`, icon: Wallet, color: 'text-warning' },
            { label: 'Total Trades', value: total_trades.toLocaleString(), icon: CreditCard, color: 'text-buy' },
            { label: 'Open Positions', value: open_positions.toLocaleString(), icon: Shield, color: 'text-text-primary' },
          ].map(c => (
            <div key={c.label} className="bg-bg-secondary border border-border-primary rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <c.icon size={16} className={c.color} />
                <p className="text-xs text-text-tertiary">{c.label}</p>
              </div>
              <p className="text-lg font-bold text-text-primary font-mono tabular-nums">{c.value}</p>
            </div>
          ))}
        </div>

        {/* User Details */}
        <div className="bg-bg-secondary border border-border-primary rounded-lg p-5">
          <h2 className="text-base font-bold text-text-primary mb-4">Personal Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'Email', value: user.email, icon: Mail },
              { label: 'Phone', value: user.phone || '—', icon: Phone },
              { label: 'Country', value: user.country || '—', icon: MapPin },
              { label: 'Address', value: user.address || '—', icon: MapPin },
              { label: 'Role', value: user.role },
              { label: 'Member Since', value: user.created_at ? new Date(user.created_at).toLocaleDateString() : '—' },
            ].map(f => (
              <div key={f.label}>
                <p className="text-xs text-text-tertiary mb-1">{f.label}</p>
                <p className="text-sm text-text-primary">{f.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Fixed Return per-user rate override */}
        <FixedReturnOverrideCard userId={userId} />

        {/* Trading Accounts */}
        <div className="bg-bg-secondary border border-border-primary rounded-lg p-5">
          <h2 className="text-base font-bold text-text-primary mb-4">Trading Accounts ({accounts.length})</h2>
          {accounts.length === 0 ? (
            <p className="text-sm text-text-tertiary py-6 text-center">No trading accounts</p>
          ) : (
            <div className="space-y-3">
              {accounts.map(a => (
                <div key={a.id} className="border border-border-primary rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-text-primary font-mono">{a.account_number}</p>
                      <p className="text-xs text-text-tertiary">{a.currency} · Leverage {a.leverage}:1 {a.is_demo ? '· Demo' : ''}</p>
                    </div>
                    <span className={cn('px-2 py-1 rounded text-xxs font-semibold', a.is_active ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger')}>
                      {a.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                      { label: 'Balance', value: `$${fmt(a.balance)}` },
                      { label: 'Credit', value: `$${fmt(a.credit)}` },
                      { label: 'Equity', value: `$${fmt(a.equity)}` },
                      { label: 'Margin Used', value: `$${fmt(a.margin_used)}` },
                      { label: 'Free Margin', value: `$${fmt(a.free_margin)}` },
                      { label: 'Margin Level', value: a.margin_level > 0 ? `${fmt(a.margin_level)}%` : '—' },
                    ].map(f => (
                      <div key={f.label}>
                        <p className="text-xxs text-text-tertiary uppercase tracking-wide">{f.label}</p>
                        <p className="text-sm text-text-primary font-mono tabular-nums">{f.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}


// ─── Fixed Return per-user rate override ─────────────────────────────

interface FRConfig {
  tiers: { label: string; min_amount: number }[];
  tenures: { label: string; days: number }[];
  rate_matrix_pct: number[][];
}

function FixedReturnOverrideCard({ userId }: { userId: string }) {
  const [globalCfg, setGlobalCfg] = useState<FRConfig | null>(null);
  // null = no override set; matrix = override active.
  const [override, setOverride] = useState<number[][] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Pull the global config from /settings so the editor's rows/columns
      // line up with whatever the admin set on /config/fixed-return.
      const [all, ov] = await Promise.all([
        adminApi.get<{ key: string; value: any }[]>('/settings').catch(() => []),
        adminApi.get<{ rate_override: { rate_matrix_pct?: number[][] } | null }>(
          `/fixed-return/users/${userId}/rate-override`,
        ).catch(() => ({ rate_override: null })),
      ]);
      const list = Array.isArray(all) ? all : [];
      const raw = list.find((s) => s.key === 'fixed_return_rates')?.value;
      const fallback: FRConfig = {
        tiers: [
          { label: '$1K', min_amount: 1000 },
          { label: '$10K', min_amount: 10000 },
          { label: '$25K', min_amount: 25000 },
          { label: '$50K', min_amount: 50000 },
          { label: '$100K', min_amount: 100000 },
        ],
        tenures: [
          { label: 'Month', days: 30 },
          { label: 'Quarter', days: 90 },
          { label: 'Half-Year', days: 180 },
          { label: 'Year', days: 365 },
          { label: '2 Year', days: 730 },
        ],
        rate_matrix_pct: [
          [1, 2, 2.5, 3, 4],
          [2, 3, 3, 3.5, 4.5],
          [3, 4, 4.5, 5, 5],
          [4, 5, 5.5, 6, 5.5],
          [5, 6, 6.5, 7, 7],
        ],
      };
      const cfg: FRConfig = raw && Array.isArray(raw.tiers) ? {
        tiers: raw.tiers,
        tenures: raw.tenures || fallback.tenures,
        rate_matrix_pct: Array.isArray(raw.rate_matrix_pct) ? raw.rate_matrix_pct : fallback.rate_matrix_pct,
      } : fallback;
      setGlobalCfg(cfg);
      const matrix = ov?.rate_override?.rate_matrix_pct;
      setOverride(Array.isArray(matrix) ? matrix : null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const enable = () => {
    if (!globalCfg) return;
    // Seed override with a copy of the current global matrix so admin
    // can edit just the cells they want different.
    setOverride(globalCfg.rate_matrix_pct.map((row) => [...row]));
  };

  const disable = async () => {
    if (!window.confirm('Clear this user\'s personal rate matrix? They will revert to the global ladder.')) return;
    setSaving(true);
    try {
      await adminApi.put(`/fixed-return/users/${userId}/rate-override`, { rate_matrix_pct: null });
      toast.success('Personal override removed');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const updateCell = (ti: number, ci: number, value: string) => {
    setOverride((prev) => {
      if (!prev) return prev;
      const n = parseFloat(value);
      const m = prev.map((row) => row.slice());
      m[ti][ci] = Number.isFinite(n) ? n : 0;
      return m;
    });
  };

  const save = async () => {
    if (!override) return;
    setSaving(true);
    try {
      await adminApi.put(`/fixed-return/users/${userId}/rate-override`, { rate_matrix_pct: override });
      toast.success('Personal rate matrix saved');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !globalCfg) {
    return (
      <div className="bg-bg-secondary border border-border-primary rounded-lg p-5">
        <Loader2 size={16} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  const isActive = override !== null;

  return (
    <div className="bg-bg-secondary border border-border-primary rounded-lg p-5">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-text-primary">Fixed Return — Personal Rates</h2>
          <p className="text-xs text-text-tertiary mt-0.5 max-w-2xl">
            Set a custom rate matrix that only applies to this trader. When inactive, the user
            sees the global ladder configured on{' '}
            <Link href="/config/fixed-return" className="text-buy hover:text-buy-light underline underline-offset-2">
              /config/fixed-return
            </Link>.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isActive ? (
            <>
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-buy rounded-md hover:bg-buy-light disabled:opacity-50"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Save
              </button>
              <button
                onClick={disable}
                disabled={saving}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-text-secondary border border-border-primary rounded-md hover:bg-bg-hover disabled:opacity-50"
              >
                <X size={12} /> Use global
              </button>
            </>
          ) : (
            <button
              onClick={enable}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-buy rounded-md hover:bg-buy-light"
            >
              Set custom rates
            </button>
          )}
        </div>
      </div>

      {isActive && override ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className="border-b border-border-primary bg-bg-tertiary/40">
                <th className="text-left px-3 py-2 text-xxs uppercase tracking-wide text-text-tertiary">Tenure</th>
                {globalCfg.tiers.map((t, i) => (
                  <th key={i} className="px-3 py-2 text-center text-xxs uppercase tracking-wide text-text-tertiary">
                    {t.label}
                    <div className="text-[10px] font-normal text-text-tertiary/70 mt-0.5">
                      ≥ ${t.min_amount.toLocaleString()}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {globalCfg.tenures.map((tn, ti) => (
                <tr key={ti} className="border-b border-border-primary/40">
                  <th scope="row" className="text-left px-3 py-2 font-medium text-text-primary text-xs">
                    {tn.label}
                    <div className="text-[10px] font-normal text-text-tertiary mt-0.5">every {tn.days} days</div>
                  </th>
                  {globalCfg.tiers.map((_, ci) => (
                    <td key={ci} className="px-2 py-2 text-center">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={override[ti]?.[ci] ?? 0}
                        onChange={(e) => updateCell(ti, ci, e.target.value)}
                        className="w-16 px-2 py-1 text-xs bg-bg-input border border-border-primary rounded font-mono tabular-nums text-text-primary text-center"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-text-tertiary mt-2">
            Each cell is the % paid <strong>per month</strong>. Same shape as the global matrix —
            if you re-shape global later, the override must match the new shape or it will be
            ignored (fall back to global) until re-saved here.
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border-primary px-4 py-6 text-center text-xs text-text-tertiary">
          No personal rates set — this user sees the global ladder.
        </div>
      )}
    </div>
  );
}
