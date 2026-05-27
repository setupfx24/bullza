'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Save, Plus, Trash2 } from 'lucide-react';
import { adminApi } from '@/lib/api';

/**
 * IB Commission Tiers — dynamic per-account-type rates.
 *
 * Columns are NOT hardcoded. We pull the live list of account types
 * from /account-types and render one rate column per active type.
 * Tier data is stored as `per_lot_by_account_type: { <lowercased_name>: rate }`
 * which matches the lookup key the IB engine uses
 * (`_referred_account_type_key` returns `AccountGroup.name.lower()`).
 *
 * Renaming an account type doesn't migrate old tier rates automatically —
 * the old key stays in the JSON, the new column shows up empty until
 * admin fills it in. Deactivating a type just hides its column from
 * the editor without erasing existing data.
 */

interface AccountTypeRow {
  id: string;
  name: string;
  is_active: boolean;
  is_demo: boolean;
}

interface Tier {
  label: string;
  min_referrals: number;
  // null = no upper bound (the top tier).
  max_referrals: number | null;
  // Flat per-lot fallback used when the user's account type isn't keyed in
  // per_lot_by_account_type below. Stays on the JSON for backward compat.
  per_lot: number;
  // Per-account-type per-lot rates. Keyed by lowercased account_group.name.
  // The IB engine resolves the referred user's account → group name and
  // looks up this map; flat per_lot is the fallback.
  per_lot_by_account_type: Record<string, number>;
  // Flat one-time payout per referred user's first approved deposit.
  // Separate from the per-lot stream that pays as referrals trade.
  per_referral_bounty: number;
  instant_payout: boolean;
  dedicated_manager: boolean;
}

const FALLBACK_TIERS: Tier[] = [
  {
    label: 'Starter',
    min_referrals: 1,
    max_referrals: 20,
    per_lot: 6,
    per_lot_by_account_type: {},
    per_referral_bounty: 5,
    instant_payout: true,
    dedicated_manager: false,
  },
  {
    label: 'Pro',
    min_referrals: 21,
    max_referrals: 100,
    per_lot: 8,
    per_lot_by_account_type: {},
    per_referral_bounty: 7,
    instant_payout: true,
    dedicated_manager: true,
  },
  {
    label: 'Elite',
    min_referrals: 101,
    max_referrals: null,
    per_lot: 13,
    per_lot_by_account_type: {},
    per_referral_bounty: 10,
    instant_payout: true,
    dedicated_manager: true,
  },
];

const groupKey = (name: string) => name.trim().toLowerCase();

export default function IBTiersAdminPage() {
  const [tiers, setTiers] = useState<Tier[]>(FALLBACK_TIERS);
  const [accountTypes, setAccountTypes] = useState<AccountTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const normalize = (r: any): Tier => {
    const fallbackPerLot = Number(r.per_lot) || 0;
    const rawMap = (r.per_lot_by_account_type || {}) as Record<string, unknown>;
    const per_lot_by_account_type: Record<string, number> = {};
    for (const [k, v] of Object.entries(rawMap)) {
      const n = Number(v);
      if (Number.isFinite(n)) per_lot_by_account_type[String(k).toLowerCase()] = n;
    }
    return {
      label: String(r.label || ''),
      min_referrals: Number(r.min_referrals) || 0,
      max_referrals: r.max_referrals == null ? null : Number(r.max_referrals) || 0,
      per_lot: fallbackPerLot,
      per_lot_by_account_type,
      per_referral_bounty: Number(r.per_referral_bounty) || 0,
      instant_payout: r.instant_payout !== false,
      dedicated_manager: !!r.dedicated_manager,
    };
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Settings + account types in parallel — neither blocks the other.
      const [all, groups] = await Promise.all([
        adminApi.get<{ key: string; value: any }[]>('/settings').catch(() => []),
        adminApi
          .get<{ items?: AccountTypeRow[] } | AccountTypeRow[]>('/account-types')
          .catch(() => []),
      ]);

      const list = Array.isArray(all) ? all : [];
      const raw = list.find((s) => s.key === 'ib_commission_tiers')?.value;
      if (Array.isArray(raw) && raw.length > 0) {
        setTiers(raw.map(normalize));
      }

      const groupItems = Array.isArray(groups) ? groups : (groups?.items || []);
      setAccountTypes(groupItems);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load IB tiers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Visible columns = live (non-demo) active account types, deduped by
  // lowercased name. Demo types are excluded because demo trades can
  // never earn IB commission — showing them was confusing admins and
  // forced rate entry for columns that would never pay out.
  // Inactive types are hidden from editing but their existing rate keys
  // stay in the JSON so reactivation re-attaches them.
  const visibleColumns = (() => {
    const seen = new Set<string>();
    const out: AccountTypeRow[] = [];
    for (const g of accountTypes) {
      if (!g.is_active) continue;
      if (g.is_demo) continue;
      const k = groupKey(g.name);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(g);
    }
    return out;
  })();

  const updateRate = (tierIdx: number, group: AccountTypeRow, value: number) => {
    setTiers((prev) => {
      const next = prev.slice();
      const cur = next[tierIdx];
      next[tierIdx] = {
        ...cur,
        per_lot_by_account_type: {
          ...cur.per_lot_by_account_type,
          [groupKey(group.name)]: value,
        },
      };
      return next;
    });
  };

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
    // Initialize each visible account-type rate to 0 so the new row
    // doesn't render blank inputs.
    const seed: Record<string, number> = {};
    for (const g of visibleColumns) seed[groupKey(g.name)] = 0;
    setTiers([
      ...tiers,
      {
        label: 'New tier',
        min_referrals: lo,
        max_referrals: lo + 9,
        per_lot: 0,
        per_lot_by_account_type: seed,
        per_referral_bounty: 0,
        instant_payout: true,
        dedicated_manager: false,
      },
    ]);
  };

  const removeTier = (i: number) => {
    if (tiers.length <= 1) return;
    setTiers((prev) => prev.filter((_, idx) => idx !== i));
  };

  const save = async () => {
    if (tiers.some((t) => !t.label.trim() || t.per_lot < 0 || t.per_referral_bounty < 0 || t.min_referrals < 0)) {
      toast.error('Every tier needs a label, non-negative threshold, per-lot and bounty.');
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

  // Minimum table width grows with the number of dynamic columns so
  // wide platforms with 6+ account types still scroll cleanly.
  const minWidth = 520 + visibleColumns.length * 130;

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">IB Commission Tiers</h1>
          <p className="text-xxs text-text-tertiary mt-0.5 max-w-3xl">
            Per-lot commission an IB earns scales with their active-referral count. The IB
            engine picks the first tier whose <strong>Min</strong> ≤ count ≤ <strong>Max</strong>.
            Leave the top tier&apos;s Max blank for &quot;no upper bound&quot;. Rate columns reflect the
            account types you&apos;ve configured in{' '}
            <a href="/account-types" className="text-buy underline">Account types</a>.
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

      {visibleColumns.length === 0 && (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
          No active account types found. Create some in{' '}
          <a href="/account-types" className="underline font-semibold">Account types</a>{' '}
          first — rate columns will appear here for every active type.
        </div>
      )}

      <div className="bg-bg-secondary border border-border-primary rounded-md overflow-x-auto">
        <table className="w-full" style={{ minWidth }}>
          <thead>
            <tr className="border-b border-border-primary bg-bg-tertiary/40">
              <th className="text-left px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Label</th>
              <th className="text-left px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Min referrals</th>
              <th className="text-left px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Max referrals</th>
              {visibleColumns.map((g) => (
                <th
                  key={g.id}
                  className="text-left px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide"
                  title={`Account type key: ${groupKey(g.name)}`}
                >
                  Per-lot {g.name} ($)
                </th>
              ))}
              {/* Only show the catch-all column when no account types are
                  configured yet — once admin has Standard/Pro/etc set up,
                  the per-type columns are sufficient and the Fallback was
                  redundant noise. The JSON field is still preserved on
                  save for safety. */}
              {visibleColumns.length === 0 && (
                <th className="text-left px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Fallback per-lot ($)</th>
              )}
              <th className="text-left px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide">Per-referral bounty ($)</th>
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
                {visibleColumns.map((g) => {
                  const k = groupKey(g.name);
                  const current = t.per_lot_by_account_type[k] ?? '';
                  return (
                    <td key={g.id} className="px-3 py-2">
                      <input
                        type="number" min={0} step={0.5}
                        value={current}
                        placeholder="inherit"
                        onChange={(e) => updateRate(i, g, parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 text-xs bg-bg-input border border-border-primary rounded font-mono tabular-nums text-text-primary"
                      />
                    </td>
                  );
                })}
                {visibleColumns.length === 0 && (
                  <td className="px-3 py-2">
                    <input
                      type="number" min={0} step={0.5}
                      value={t.per_lot}
                      onChange={(e) => updateTier(i, 'per_lot', parseFloat(e.target.value) || 0)}
                      title="Used for any account type that doesn't have a specific rate above."
                      className="w-24 px-2 py-1 text-xs bg-bg-input border border-border-primary rounded font-mono tabular-nums text-text-primary"
                    />
                  </td>
                )}
                <td className="px-3 py-2">
                  <input
                    type="number" min={0} step={0.5}
                    value={t.per_referral_bounty}
                    onChange={(e) => updateTier(i, 'per_referral_bounty', parseFloat(e.target.value) || 0)}
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
              {/* colSpan tracks visible columns:
                  3 fixed (Label/Min/Max) + N type cols + (1 fallback when N=0) +
                  4 trailing (Bounty/Instant/Manager/trash) */}
              <td
                colSpan={3 + visibleColumns.length + (visibleColumns.length === 0 ? 1 : 0) + 4}
                className="px-3 py-2"
              >
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
          <strong>Per-lot resolver priority:</strong> 1) per-agent custom override on the IB profile,
          2) this tier&apos;s <em>per-account-type</em> rate (looked up by lowercased account type name),
          3) this tier&apos;s <em>fallback per-lot</em>, 4) the IB commission plan&apos;s default.
          First non-null wins.
        </p>
        <p>
          <strong>Per-referral bounty</strong> is paid once, when a referred user makes their
          first approved deposit. The IB&apos;s current tier (by active-referral count) determines
          the amount.
        </p>
        <p>
          <strong>Renaming an account type</strong> in{' '}
          <a href="/account-types" className="text-buy underline">Account types</a>{' '}
          doesn&apos;t migrate this table&apos;s rates — the old key stays on the JSON and a new
          empty column appears for the renamed type. Re-enter the rate and save to update.
        </p>
      </div>
    </div>
  );
}
