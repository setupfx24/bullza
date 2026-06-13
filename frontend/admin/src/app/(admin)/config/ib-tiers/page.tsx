'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Save, Plus, Trash2 } from 'lucide-react';
import { adminApi } from '@/lib/api';

/**
 * IB Commission Tiers (2026-06-11 model).
 *
 * Four named tiers (Bronze / Silver / Gold / Platinum) with a flat
 * per-lot commission. An IB reaches a tier when EITHER their activation
 * count OR the cumulative deposit amount their referrals brought meets
 * the tier threshold — whichever qualifies for the higher tier.
 *   - activation = referred user who is KYC-approved AND has >= 3 closed
 *     trades (the ib_commission_min_trades setting).
 *   - amount     = sum of all approved deposits across the IB's referrals.
 * A per-IB custom override (set on the IB profile, e.g. $15) outranks
 * this ladder for specific top partners.
 *
 * Stored under system_settings.ib_commission_tiers and read by the IB
 * engine (resolve_tier / compute_ib_qualification).
 */

interface Tier {
  label: string;
  per_lot: number;
  min_activations: number;
  min_amount: number;
}

const FALLBACK_TIERS: Tier[] = [
  { label: 'Bronze',   per_lot: 5,  min_activations: 5,   min_amount: 500 },
  { label: 'Silver',   per_lot: 7,  min_activations: 20,  min_amount: 5000 },
  { label: 'Gold',     per_lot: 10, min_activations: 50,  min_amount: 20000 },
  { label: 'Platinum', per_lot: 12, min_activations: 100, min_amount: 50000 },
];

export default function IBTiersAdminPage() {
  const [tiers, setTiers] = useState<Tier[]>(FALLBACK_TIERS);
  // Activation rule (what makes a referred user count as an "activation").
  const [minTrades, setMinTrades] = useState(3);
  const [requiresKyc, setRequiresKyc] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const normalize = (r: any): Tier => ({
    label: String(r.label || ''),
    per_lot: Number(r.per_lot) || 0,
    min_activations: Number(r.min_activations) || 0,
    min_amount: Number(r.min_amount) || 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await adminApi.get<{ key: string; value: any }[]>('/settings').catch(() => []);
      const list = Array.isArray(all) ? all : [];
      const raw = list.find((s) => s.key === 'ib_commission_tiers')?.value;
      // Only adopt stored tiers if they're in the new shape (have a
      // min_activations / min_amount field). Legacy referral-count tiers
      // fall back to the new default ladder.
      if (Array.isArray(raw) && raw.length > 0 && raw.some((t: any) => t.min_activations != null || t.min_amount != null)) {
        setTiers(raw.map(normalize));
      }
      const mt = list.find((s) => s.key === 'ib_commission_min_trades')?.value;
      if (mt != null && Number.isFinite(Number(mt))) setMinTrades(Number(mt));
      const rk = list.find((s) => s.key === 'ib_commission_requires_kyc')?.value;
      if (rk != null) setRequiresKyc(rk === true || rk === 'true' || rk === 1 || rk === '1');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load IB tiers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateTier = <K extends keyof Tier>(i: number, field: K, value: Tier[K]) => {
    setTiers((prev) => {
      const next = prev.slice();
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };

  const addTier = () => {
    const last = tiers[tiers.length - 1];
    setTiers([
      ...tiers,
      {
        label: 'New tier',
        per_lot: last ? last.per_lot + 1 : 5,
        min_activations: last ? last.min_activations * 2 : 5,
        min_amount: last ? last.min_amount * 2 : 500,
      },
    ]);
  };

  const removeTier = (i: number) => {
    if (tiers.length <= 1) return;
    setTiers((prev) => prev.filter((_, idx) => idx !== i));
  };

  const save = async () => {
    if (tiers.some((t) => !t.label.trim() || t.per_lot < 0 || t.min_activations < 0 || t.min_amount < 0)) {
      toast.error('Every tier needs a label and non-negative per-lot / thresholds.');
      return;
    }
    // Sort by per-lot ascending so the ladder reads low→high. The engine
    // resolves by "highest qualifying tier", so order is cosmetic, but a
    // sorted list is clearer for the next admin.
    const sorted = [...tiers].sort((a, b) => a.per_lot - b.per_lot);
    setSaving(true);
    try {
      await adminApi.put('/settings', {
        settings: {
          ib_commission_tiers: sorted,
          ib_commission_min_trades: Math.max(0, Math.floor(minTrades) || 0),
          ib_commission_requires_kyc: requiresKyc,
        },
      });
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
    <div className="p-4 sm:p-6 space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">IB Commission Tiers</h1>
          <p className="text-xxs text-text-tertiary mt-0.5 max-w-3xl">
            Per-lot commission an IB earns. An IB reaches a tier when{' '}
            <strong>EITHER</strong> their <strong>activations</strong> reach the threshold{' '}
            <strong>OR</strong> the <strong>cumulative deposit amount</strong> their referrals
            brought reaches the threshold — whichever qualifies for the higher tier.
            An <em>activation</em> = a referred user who is KYC-approved and has placed at
            least 3 closed trades.
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

      {/* Activation rule — what makes a referred user count toward the
          activation thresholds above. Fully admin-editable. */}
      <div className="bg-bg-secondary border border-border-primary rounded-md p-4 space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">Activation rule</h2>
        <p className="text-xxs text-text-tertiary -mt-1">
          A referred user counts as one <strong>activation</strong> once they meet these conditions.
        </p>
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            Minimum completed trades
            <input
              type="number" min={0}
              value={minTrades}
              onChange={(e) => setMinTrades(parseInt(e.target.value) || 0)}
              className="w-20 px-2 py-1 text-xs bg-bg-input border border-border-primary rounded font-mono tabular-nums text-text-primary"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={requiresKyc}
              onChange={(e) => setRequiresKyc(e.target.checked)}
              className="w-4 h-4 accent-buy"
            />
            Require KYC approved
          </label>
        </div>
      </div>

      <div className="bg-bg-secondary border border-border-primary rounded-md overflow-x-auto">
        <table className="w-full" style={{ minWidth: 560 }}>
          <thead>
            <tr className="border-b border-border-primary bg-bg-tertiary/40">
              <th className="text-left px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Tier</th>
              <th className="text-left px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Per-lot ($)</th>
              <th className="text-left px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Min activations</th>
              <th className="text-left px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide">OR min amount ($)</th>
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
                    className="w-32 px-2 py-1 text-xs bg-bg-input border border-border-primary rounded text-text-primary"
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
                <td className="px-3 py-2">
                  <input
                    type="number" min={0}
                    value={t.min_activations}
                    onChange={(e) => updateTier(i, 'min_activations', parseInt(e.target.value) || 0)}
                    className="w-24 px-2 py-1 text-xs bg-bg-input border border-border-primary rounded font-mono tabular-nums text-text-primary"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number" min={0} step={100}
                    value={t.min_amount}
                    onChange={(e) => updateTier(i, 'min_amount', parseFloat(e.target.value) || 0)}
                    className="w-28 px-2 py-1 text-xs bg-bg-input border border-border-primary rounded font-mono tabular-nums text-text-primary"
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
              <td colSpan={5} className="px-3 py-2">
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

      <div className="text-[11px] text-text-tertiary max-w-3xl space-y-1">
        <p>
          <strong>Qualification is OR-based:</strong> an IB gets a tier if their activation
          count <em>or</em> their referrals&apos; cumulative deposit total reaches that tier&apos;s
          threshold. The engine pays the highest tier reached.
        </p>
        <p>
          <strong>Top custom deal:</strong> to give a specific partner a fixed rate (e.g. $15/lot)
          that ignores this ladder, set the IB&apos;s <em>custom commission per lot</em> on their
          profile in <a href="/business/ib" className="text-buy underline">Business → IB</a>.
          A per-IB override always wins.
        </p>
      </div>
    </div>
  );
}
