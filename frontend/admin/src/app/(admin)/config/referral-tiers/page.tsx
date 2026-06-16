'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Save, Plus, Trash2 } from 'lucide-react';
import { adminApi } from '@/lib/api';

/**
 * Personal Referral Tiers — INDEPENDENT of the IB / sub-broker MLM ladder.
 *
 * This is the friend-referral program: a user shares their personal
 * referral code, and when a referred friend qualifies the referrer can
 * claim a flat bounty. The bounty can scale by how many referrals the
 * referrer has already claimed (tier ladder).
 *
 * Stored under system_settings.referral_tiers as a list of
 *   { label, min_referrals, max_referrals, per_referral_bounty }
 * and read by:
 *   - the gateway money path (referral_service._bounty_for_next_claim,
 *     resolves the bounty by the referrer's claimed-referral position), and
 *   - the public trader feed (gateway api/referral_tiers.py /tiers).
 *
 * This editor used to be the IB tier editor (/config/ib-tiers), which wrote
 * the shared `ib_commission_tiers` key — that coupled the two programs. The
 * referral program now owns its own key + qualification settings here, so
 * editing referral tiers no longer touches IB commission.
 */

interface Tier {
  label: string;
  per_referral_bounty: number;
  min_referrals: number;
  max_referrals: number | null; // null / empty = no upper bound
}

const FALLBACK_TIERS: Tier[] = [
  { label: 'Starter', per_referral_bounty: 5,  min_referrals: 1,  max_referrals: 5 },
  { label: 'Bronze',  per_referral_bounty: 8,  min_referrals: 6,  max_referrals: 20 },
  { label: 'Silver',  per_referral_bounty: 12, min_referrals: 21, max_referrals: 50 },
  { label: 'Gold',    per_referral_bounty: 18, min_referrals: 51, max_referrals: null },
];

export default function ReferralTiersAdminPage() {
  const [tiers, setTiers] = useState<Tier[]>(FALLBACK_TIERS);
  // Flat fallback bounty used when no tier matches the referrer's position.
  const [flatBounty, setFlatBounty] = useState(5);
  // Qualification rule — what makes a referred user "qualify" so the
  // referrer may claim. Mirrors the keys read by api/referral_tiers.py.
  const [requiredTrades, setRequiredTrades] = useState(3);
  const [requiresKyc, setRequiresKyc] = useState(true);
  const [requiresFunded, setRequiresFunded] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const normalize = (r: any): Tier => {
    const hiRaw = r.max_referrals;
    const hi =
      hiRaw == null || hiRaw === '' || hiRaw === 'null' ? null : Number(hiRaw) || null;
    return {
      label: String(r.label || ''),
      per_referral_bounty: Number(r.per_referral_bounty) || 0,
      min_referrals: Number(r.min_referrals) || 0,
      max_referrals: hi,
    };
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await adminApi.get<{ key: string; value: any }[]>('/settings').catch(() => []);
      const list = Array.isArray(all) ? all : [];
      const raw = list.find((s) => s.key === 'referral_tiers')?.value;
      if (Array.isArray(raw) && raw.length > 0) {
        setTiers(raw.map(normalize));
      }
      const flat = list.find((s) => s.key === 'referral_commission_amount_usd')?.value;
      if (flat != null && Number.isFinite(Number(flat))) setFlatBounty(Number(flat));
      const rt = list.find((s) => s.key === 'referral_qualifying_trades')?.value;
      if (rt != null && Number.isFinite(Number(rt))) setRequiredTrades(Number(rt));
      const rk = list.find((s) => s.key === 'referral_requires_kyc')?.value;
      if (rk != null) setRequiresKyc(rk === true || rk === 'true' || rk === 1 || rk === '1');
      const rf = list.find((s) => s.key === 'referral_requires_funded')?.value;
      if (rf != null) setRequiresFunded(rf === true || rf === 'true' || rf === 1 || rf === '1');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load referral tiers');
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
    const nextMin = last ? (last.max_referrals != null ? last.max_referrals + 1 : last.min_referrals + 1) : 1;
    setTiers([
      ...tiers,
      {
        label: 'New tier',
        per_referral_bounty: last ? last.per_referral_bounty + 2 : 5,
        min_referrals: nextMin,
        max_referrals: null,
      },
    ]);
  };

  const removeTier = (i: number) => {
    if (tiers.length <= 1) return;
    setTiers((prev) => prev.filter((_, idx) => idx !== i));
  };

  const save = async () => {
    if (tiers.some((t) => !t.label.trim() || t.per_referral_bounty < 0 || t.min_referrals < 0)) {
      toast.error('Every tier needs a label and non-negative bounty / min referrals.');
      return;
    }
    if (tiers.some((t) => t.max_referrals != null && t.max_referrals < t.min_referrals)) {
      toast.error('Max referrals must be blank (unlimited) or ≥ min referrals.');
      return;
    }
    // Sort by min_referrals ascending so the ladder reads entry → top.
    const sorted = [...tiers].sort((a, b) => a.min_referrals - b.min_referrals);
    setSaving(true);
    try {
      await adminApi.put('/settings', {
        settings: {
          referral_tiers: sorted.map((t) => ({
            label: t.label.trim(),
            per_referral_bounty: t.per_referral_bounty,
            min_referrals: t.min_referrals,
            max_referrals: t.max_referrals, // null = unlimited
          })),
          referral_commission_amount_usd: Math.max(0, flatBounty || 0),
          referral_qualifying_trades: Math.max(0, Math.floor(requiredTrades) || 0),
          referral_requires_kyc: requiresKyc,
          referral_requires_funded: requiresFunded,
        },
      });
      toast.success('Referral tiers saved');
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
          <h1 className="text-lg font-semibold text-text-primary">Referral Tiers</h1>
          <p className="text-xxs text-text-tertiary mt-0.5 max-w-3xl">
            The <strong>personal friend-referral</strong> bounty ladder — completely separate
            from the IB / sub-broker commission ladder. The bounty a referrer can claim scales
            by how many referrals they have already claimed: a referrer at position{' '}
            <em>N</em> earns the bounty of the tier whose range includes <em>N</em>. If no tier
            matches, the flat fallback bounty is paid.
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

      {/* Qualification rule — what makes a referred user "qualify" so the
          referrer may claim. Matches keys read by api/referral_tiers.py. */}
      <div className="bg-bg-secondary border border-border-primary rounded-md p-4 space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">Qualification rule</h2>
        <p className="text-xxs text-text-tertiary -mt-1">
          A referred user must meet these conditions before the referrer can claim their bounty.
        </p>
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            Minimum completed trades
            <input
              type="number" min={0}
              value={requiredTrades}
              onChange={(e) => setRequiredTrades(parseInt(e.target.value) || 0)}
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
          <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={requiresFunded}
              onChange={(e) => setRequiresFunded(e.target.checked)}
              className="w-4 h-4 accent-buy"
            />
            Require funded account
          </label>
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            Flat fallback bounty ($)
            <input
              type="number" min={0} step={0.5}
              value={flatBounty}
              onChange={(e) => setFlatBounty(parseFloat(e.target.value) || 0)}
              className="w-24 px-2 py-1 text-xs bg-bg-input border border-border-primary rounded font-mono tabular-nums text-text-primary"
            />
          </label>
        </div>
      </div>

      <div className="bg-bg-secondary border border-border-primary rounded-md overflow-x-auto">
        <table className="w-full" style={{ minWidth: 560 }}>
          <thead>
            <tr className="border-b border-border-primary bg-bg-tertiary/40">
              <th className="text-left px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Tier</th>
              <th className="text-left px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Bounty / referral ($)</th>
              <th className="text-left px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Min referrals</th>
              <th className="text-left px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Max referrals (blank = ∞)</th>
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
                    value={t.per_referral_bounty}
                    onChange={(e) => updateTier(i, 'per_referral_bounty', parseFloat(e.target.value) || 0)}
                    className="w-24 px-2 py-1 text-xs bg-bg-input border border-border-primary rounded font-mono tabular-nums text-text-primary"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number" min={0}
                    value={t.min_referrals}
                    onChange={(e) => updateTier(i, 'min_referrals', parseInt(e.target.value) || 0)}
                    className="w-24 px-2 py-1 text-xs bg-bg-input border border-border-primary rounded font-mono tabular-nums text-text-primary"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number" min={0}
                    value={t.max_referrals ?? ''}
                    placeholder="∞"
                    onChange={(e) =>
                      updateTier(i, 'max_referrals', e.target.value === '' ? null : parseInt(e.target.value) || 0)
                    }
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
          <strong>Independent of IB:</strong> these tiers control only the personal
          friend-referral bounty. The IB / sub-broker per-lot commission ladder is managed
          separately under <a href="/config/ib-tiers" className="text-buy underline">Config → IB Tiers</a>.
        </p>
      </div>
    </div>
  );
}
