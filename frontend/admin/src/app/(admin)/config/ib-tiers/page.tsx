'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Save, Plus, Trash2 } from 'lucide-react';
import { adminApi } from '@/lib/api';

interface Tier {
  label: string;
  min_referrals: number;
  // null = no upper bound (the top tier).
  max_referrals: number | null;
  per_lot: number;
  instant_payout: boolean;
  dedicated_manager: boolean;
}

const FALLBACK: Tier[] = [
  { label: 'Starter', min_referrals: 5,   max_referrals: 20,   per_lot: 6,  instant_payout: true, dedicated_manager: false },
  { label: 'Pro',     min_referrals: 21,  max_referrals: 100,  per_lot: 8,  instant_payout: true, dedicated_manager: true  },
  { label: 'Elite',   min_referrals: 101, max_referrals: null, per_lot: 13, instant_payout: true, dedicated_manager: true  },
];

export default function IBTiersAdminPage() {
  const [tiers, setTiers] = useState<Tier[]>(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await adminApi.get<{ key: string; value: any }[]>('/settings');
      const list = Array.isArray(all) ? all : [];
      const raw = list.find((s) => s.key === 'ib_commission_tiers')?.value;
      if (Array.isArray(raw) && raw.length > 0) {
        setTiers(raw.map(normalize));
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load IB tiers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const normalize = (r: any): Tier => ({
    label: String(r.label || ''),
    min_referrals: Number(r.min_referrals) || 0,
    max_referrals: r.max_referrals == null ? null : Number(r.max_referrals) || 0,
    per_lot: Number(r.per_lot) || 0,
    instant_payout: r.instant_payout !== false,
    dedicated_manager: !!r.dedicated_manager,
  });

  const updateTier = <K extends keyof Tier>(i: number, field: K, value: Tier[K]) => {
    setTiers((prev) => {
      const next = prev.slice();
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };

  const addTier = () => {
    const last = tiers[tiers.length - 1];
    const lo = last ? (last.max_referrals ?? last.min_referrals) + 1 : 1;
    setTiers([
      ...tiers,
      { label: 'New tier', min_referrals: lo, max_referrals: lo + 9, per_lot: 0, instant_payout: true, dedicated_manager: false },
    ]);
  };

  const removeTier = (i: number) => {
    if (tiers.length <= 1) return;
    setTiers((prev) => prev.filter((_, idx) => idx !== i));
  };

  const save = async () => {
    if (tiers.some((t) => !t.label.trim() || t.per_lot < 0 || t.min_referrals < 0)) {
      toast.error('Every tier needs a label, non-negative threshold and per-lot.');
      return;
    }
    // Ensure tiers are sorted by min_referrals ascending and non-overlapping —
    // simple sanity check; the resolver picks the first matching range,
    // so an out-of-order list would silently mis-pay commissions.
    const sorted = [...tiers].sort((a, b) => a.min_referrals - b.min_referrals);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      const prevHi = prev.max_referrals ?? Number.POSITIVE_INFINITY;
      if (cur.min_referrals <= prevHi) {
        toast.error(`Tier "${cur.label}" starts at ${cur.min_referrals} but "${prev.label}" runs to ${prev.max_referrals ?? '∞'}`);
        return;
      }
    }
    setSaving(true);
    try {
      await adminApi.put('/settings', { settings: { ib_commission_tiers: sorted } });
      toast.success('IB commission tiers saved');
      setTiers(sorted);
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 size={20} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">IB Commission Tiers</h1>
          <p className="text-xxs text-text-tertiary mt-0.5 max-w-2xl">
            Per-lot commission an IB earns scales with their active-referral count. The IB
            engine picks the first tier whose <strong>Min</strong> ≤ count ≤ <strong>Max</strong>.
            Leave the top tier&apos;s Max blank for &quot;no upper bound&quot;.
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-buy rounded-md hover:bg-buy-light disabled:opacity-50"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
        </button>
      </div>

      <div className="bg-bg-secondary border border-border-primary rounded-md overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-border-primary bg-bg-tertiary/40">
              <th className="text-left px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Label</th>
              <th className="text-left px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Min referrals</th>
              <th className="text-left px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Max referrals</th>
              <th className="text-left px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Per-lot ($)</th>
              <th className="text-center px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Instant payout</th>
              <th className="text-center px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Dedicated manager</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((t, i) => (
              <tr key={i} className="border-b border-border-primary/50 last:border-0 hover:bg-bg-hover/30">
                <td className="px-3 py-2">
                  <input
                    value={t.label}
                    onChange={(e) => updateTier(i, 'label', e.target.value)}
                    className="w-28 px-2 py-1 text-xs bg-bg-input border border-border-primary rounded text-text-primary"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number" min={0}
                    value={t.min_referrals}
                    onChange={(e) => updateTier(i, 'min_referrals', parseInt(e.target.value) || 0)}
                    className="w-20 px-2 py-1 text-xs bg-bg-input border border-border-primary rounded font-mono tabular-nums text-text-primary"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number" min={0}
                    value={t.max_referrals ?? ''}
                    placeholder="∞"
                    onChange={(e) => updateTier(i, 'max_referrals', e.target.value === '' ? null : (parseInt(e.target.value) || 0))}
                    className="w-20 px-2 py-1 text-xs bg-bg-input border border-border-primary rounded font-mono tabular-nums text-text-primary"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number" min={0} step={0.5}
                    value={t.per_lot}
                    onChange={(e) => updateTier(i, 'per_lot', parseFloat(e.target.value) || 0)}
                    className="w-24 px-2 py-1 text-xs bg-bg-input border border-border-primary rounded font-mono tabular-nums text-text-primary"
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={t.instant_payout}
                    onChange={(e) => updateTier(i, 'instant_payout', e.target.checked)}
                    className="w-4 h-4 accent-buy"
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={t.dedicated_manager}
                    onChange={(e) => updateTier(i, 'dedicated_manager', e.target.checked)}
                    className="w-4 h-4 accent-buy"
                  />
                </td>
                <td className="px-2 py-2 text-right">
                  <button
                    onClick={() => removeTier(i)}
                    disabled={tiers.length <= 1}
                    className="p-1 text-text-tertiary hover:text-danger disabled:opacity-30"
                    title="Remove tier"
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={7} className="px-3 py-2">
                <button
                  onClick={addTier}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xxs text-text-secondary border border-border-primary rounded hover:bg-bg-hover"
                >
                  <Plus size={11} /> Add tier
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-text-tertiary max-w-2xl">
        <strong>Resolver priority for per-lot:</strong> 1) a per-agent custom override on the
        IB profile, 2) this tier ladder, 3) the IB commission plan&apos;s default. The first
        non-null value wins.
      </p>
    </div>
  );
}
