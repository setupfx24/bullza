'use client';

/**
 * Admin → Referral Bonus Campaigns (client 2026-07-28).
 *
 * Time-limited promotional referral bonuses, fully self-serve: admin sets
 * a name, a flat USD amount, a hard cap on referrers who can claim it, and
 * a trades-required gate (0 = pays on KYC approval alone, N = pays once
 * the referred user has N closed trades AND approved KYC). The award
 * itself happens server-side at the KYC-approval / trade-close hook
 * points — this page only manages campaign config and shows the claims
 * audit trail.
 */
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Gift, Loader2, ListChecks, Plus, X } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Campaign {
  id: string;
  name: string;
  amount_usd: string;
  max_claims: number;
  claimed_count: number;
  remaining: number;
  required_trades: number;
  is_active: boolean;
  created_at: string | null;
}

interface ClaimRow {
  referrer_email: string;
  referrer_name: string;
  amount_usd: string;
  claimed_at: string | null;
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusOf(c: Campaign): { label: string; cls: string } {
  if (!c.is_active) return { label: 'paused', cls: 'bg-bg-hover text-text-tertiary' };
  if (c.claimed_count >= c.max_claims) return { label: 'fully claimed', cls: 'bg-warning/15 text-warning' };
  return { label: 'active', cls: 'bg-success/15 text-success' };
}

export default function ReferralCampaignsAdminPage() {
  const [items, setItems] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [amountUsd, setAmountUsd] = useState('10');
  const [maxClaims, setMaxClaims] = useState('100');
  const [requiredTrades, setRequiredTrades] = useState('0');
  const [saving, setSaving] = useState(false);

  const [claimsFor, setClaimsFor] = useState<Campaign | null>(null);
  const [claims, setClaims] = useState<ClaimRow[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.get<{ items: Campaign[] }>('/referral-campaigns');
      setItems(r?.items || []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const openClaims = async (c: Campaign) => {
    setClaimsFor(c);
    setClaims(null);
    try {
      const r = await adminApi.get<{ items: ClaimRow[] }>(`/referral-campaigns/${c.id}/claims`);
      setClaims(r?.items || []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load claims');
    }
  };

  const toggleActive = async (c: Campaign) => {
    setTogglingId(c.id);
    try {
      await adminApi.patch(`/referral-campaigns/${c.id}`, { is_active: !c.is_active });
      toast.success(c.is_active ? 'Campaign paused' : 'Campaign reactivated');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    } finally {
      setTogglingId(null);
    }
  };

  const resetForm = () => {
    setName('');
    setAmountUsd('10');
    setMaxClaims('100');
    setRequiredTrades('0');
  };

  const submit = async () => {
    if (!name.trim()) { toast.error('Campaign name is required'); return; }
    const amount = parseFloat(amountUsd);
    const max = parseInt(maxClaims, 10);
    const trades = parseInt(requiredTrades, 10);
    if (!Number.isFinite(amount) || amount <= 0) { toast.error('Bonus amount must be a positive number'); return; }
    if (!Number.isFinite(max) || max <= 0) { toast.error('Maximum users must be a positive whole number'); return; }
    if (!Number.isFinite(trades) || trades < 0) { toast.error('Trades required cannot be negative'); return; }

    setSaving(true);
    try {
      await adminApi.post('/referral-campaigns', {
        name: name.trim(),
        amount_usd: amount,
        max_claims: max,
        required_trades: trades,
        is_active: true,
      });
      toast.success('Campaign created');
      setShowCreate(false);
      resetForm();
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Gift size={18} className="text-text-secondary" />
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Referral Bonus Campaigns</h1>
            <p className="text-xxs text-text-tertiary mt-0.5 max-w-2xl">
              Time-limited promos: the referrer is paid once their referred friend qualifies
              (KYC only, or KYC + N closed trades), capped to a set number of users. Stops paying
              out automatically once the cap is hit — no need to manually turn it off.
            </p>
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setShowCreate(true); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-buy rounded-md hover:bg-buy-light transition-fast"
        >
          <Plus size={13} /> New Campaign
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-text-tertiary" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-text-tertiary py-10 text-center">No campaigns yet — create the first one.</p>
      ) : (
        <div className="space-y-3">
          {items.map((c) => {
            const status = statusOf(c);
            const pct = c.max_claims > 0 ? Math.min(100, (c.claimed_count / c.max_claims) * 100) : 0;
            return (
              <div key={c.id} className="rounded-lg border border-border-primary bg-bg-secondary p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-text-primary">{c.name}</span>
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-md font-bold uppercase', status.cls)}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-tertiary mt-0.5">
                      Created {fmtDate(c.created_at)} · ${c.amount_usd} per referrer ·{' '}
                      {c.required_trades > 0
                        ? `KYC + ${c.required_trades} trade${c.required_trades === 1 ? '' : 's'}`
                        : 'KYC only'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => void openClaims(c)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xxs font-medium text-text-secondary border border-border-primary hover:bg-bg-hover"
                    >
                      <ListChecks size={12} /> Claims
                    </button>
                    <button
                      onClick={() => void toggleActive(c)}
                      disabled={togglingId === c.id}
                      className={cn(
                        'px-2.5 py-1.5 rounded-md text-xxs font-medium border transition-fast disabled:opacity-50',
                        c.is_active
                          ? 'text-danger border-danger/40 hover:bg-danger/10'
                          : 'text-success border-success/40 hover:bg-success/10',
                      )}
                    >
                      {togglingId === c.id ? <Loader2 size={12} className="animate-spin" /> : c.is_active ? 'Pause' : 'Reactivate'}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="h-2 rounded-full bg-bg-tertiary overflow-hidden">
                    <div className="h-full bg-buy transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-[11px] text-text-tertiary">
                    <span className="font-mono tabular-nums">{c.claimed_count} / {c.max_claims} claimed</span>
                    <span>{c.remaining} spots remaining</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-md rounded-xl border border-border-primary bg-bg-secondary p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-text-primary">New Referral Bonus Campaign</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 text-text-tertiary hover:text-text-primary"><X size={16} /></button>
            </div>
            <div>
              <label className="block text-xxs text-text-tertiary mb-1">Campaign name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. August KYC Bonus"
                className="w-full text-xs py-2 px-2 bg-bg-input border border-border-primary rounded-md text-text-primary"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xxs text-text-tertiary mb-1">Bonus amount ($)</label>
                <input
                  type="number" min="0" step="0.5"
                  value={amountUsd}
                  onChange={(e) => setAmountUsd(e.target.value)}
                  className="w-full text-xs py-2 px-2 bg-bg-input border border-border-primary rounded-md font-mono text-text-primary"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xxs text-text-tertiary mb-1">Max users</label>
                <input
                  type="number" min="1" step="1"
                  value={maxClaims}
                  onChange={(e) => setMaxClaims(e.target.value)}
                  className="w-full text-xs py-2 px-2 bg-bg-input border border-border-primary rounded-md font-mono text-text-primary"
                />
              </div>
            </div>
            <div>
              <label className="block text-xxs text-text-tertiary mb-1">Trades required (0 = pays on KYC approval alone)</label>
              <input
                type="number" min="0" step="1"
                value={requiredTrades}
                onChange={(e) => setRequiredTrades(e.target.value)}
                className="w-full text-xs py-2 px-2 bg-bg-input border border-border-primary rounded-md font-mono text-text-primary"
              />
            </div>
            <button
              onClick={() => void submit()}
              disabled={saving}
              className="w-full py-2.5 rounded-md text-xs font-bold text-white bg-buy hover:bg-buy-light disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create Campaign'}
            </button>
          </div>
        </div>
      )}

      {/* Claims modal — support/audit trail */}
      {claimsFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setClaimsFor(null)} />
          <div className="relative w-full max-w-2xl rounded-xl border border-border-primary bg-bg-secondary p-5 space-y-3 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-text-primary">Claims — {claimsFor.name}</h2>
              <button onClick={() => setClaimsFor(null)} className="p-1 text-text-tertiary hover:text-text-primary"><X size={16} /></button>
            </div>
            {claims === null ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-text-tertiary" /></div>
            ) : claims.length === 0 ? (
              <p className="text-xs text-text-tertiary py-6 text-center">No one has claimed this campaign yet.</p>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-bg-tertiary/40">
                  <tr className="text-xxs uppercase text-text-tertiary">
                    <th className="px-3 py-2">Referrer</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-right">Claimed</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((r, i) => (
                    <tr key={i} className="border-t border-border-primary/50 text-xs">
                      <td className="px-3 py-2">
                        <span className="text-text-primary">{r.referrer_name || '—'}</span>
                        <span className="block text-[10px] text-text-tertiary">{r.referrer_email}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-buy">${r.amount_usd}</td>
                      <td className="px-3 py-2 text-right text-text-tertiary">{fmtDate(r.claimed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
