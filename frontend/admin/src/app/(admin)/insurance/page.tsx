'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Save, ShieldCheck, AlertTriangle, RefreshCw } from 'lucide-react';
import { adminApi } from '@/lib/api';

/**
 * Admin control panel for Trade Insurance.
 *
 * Talks to the gateway/admin pair of endpoints:
 *   GET  /api/v1/admin/insurance/settings  — every insurance_* tunable
 *   PUT  /api/v1/admin/insurance/settings  — upsert any subset
 *   GET  /api/v1/admin/insurance/stats     — 24h / 7d / lifetime revenue
 *
 * No new backend routes added — everything below is already exposed at
 * backend/services/admin/routes/insurance.py since 2026-Q1. The reason
 * the admin still had a gap is there was no UI on top of those endpoints.
 */

// Mirrors INSURANCE_KEYS in backend/services/admin/routes/insurance.py.
// The order here drives the form layout below.
const NUMERIC_KEYS = [
  'insurance_base_constant',
  'insurance_coverage_pct',
  'insurance_fee_cap',
  'insurance_fee_cap_high_volume',
  'insurance_high_volume_lots',
  'insurance_min_trade_duration_seconds',
  'insurance_anti_abuse_daily_claims',
  'insurance_anti_abuse_daily_payout',
  'insurance_anti_abuse_cooldown_hours',
  'insurance_dynamic_high_lev_threshold',
  'insurance_dynamic_high_lev_surcharge',
  'insurance_dynamic_no_sl_surcharge',
  'insurance_dynamic_winrate_threshold',
  'insurance_dynamic_winrate_surcharge',
] as const;

const BOOL_KEYS = [
  'insurance_enabled',
  'insurance_disable_atr_floor',
] as const;

// JSON-shaped keys — kept as <textarea> blobs and parsed on save so admin
// has full control without us shipping a per-key custom editor for each.
const JSON_KEYS = [
  'insurance_tier_multipliers',
  'insurance_max_cap_rules',
  'insurance_news_blackout_until',
] as const;

const KEY_LABELS: Record<string, { label: string; hint: string }> = {
  insurance_enabled: {
    label: 'Trade insurance feature',
    hint: 'Master switch. Off = no new policies can be opened (existing policies still settle).',
  },
  insurance_base_constant: {
    label: 'Base premium constant ($)',
    hint: 'Fee = base * tier_multiplier * (ATR-scaled risk). Bigger = more expensive policies.',
  },
  insurance_tier_multipliers: {
    label: 'Tier multipliers (JSON)',
    hint: 'Object keyed by tier ID, e.g. {"basic":1, "standard":1.5, "premium":2}. Higher tier = larger payout cap + larger fee multiplier.',
  },
  insurance_coverage_pct: {
    label: 'Coverage % of loss',
    hint: 'When a policy fires, how much of the realised loss the platform pays. 0.5 = 50%.',
  },
  insurance_fee_cap: {
    label: 'Per-trade fee cap ($)',
    hint: 'Hard ceiling on the premium for ordinary lots so a single huge trade can’t pay $10k of insurance.',
  },
  insurance_fee_cap_high_volume: {
    label: 'High-volume fee cap ($)',
    hint: 'Higher ceiling applied when trade lots >= the threshold below.',
  },
  insurance_high_volume_lots: {
    label: 'High-volume threshold (lots)',
    hint: 'At this lot size and above, the high-volume fee cap kicks in.',
  },
  insurance_max_cap_rules: {
    label: 'Payout cap rules (JSON)',
    hint: 'Array of {tier, max_payout_usd} pairs. Empty array = unlimited per-policy payout, throttled only by daily anti-abuse.',
  },
  insurance_min_trade_duration_seconds: {
    label: 'Min trade duration (seconds)',
    hint: 'Anti-abuse: a position closed in less than this many seconds can’t claim. Set to 0 to disable.',
  },
  insurance_anti_abuse_daily_claims: {
    label: 'Max claims / day / user',
    hint: 'Anti-abuse: any user filing more than this many claims in 24h is throttled.',
  },
  insurance_anti_abuse_daily_payout: {
    label: 'Max daily payout / user ($)',
    hint: 'Anti-abuse: cumulative cap per user across all policies in a 24h window.',
  },
  insurance_anti_abuse_cooldown_hours: {
    label: 'Anti-abuse cooldown (hours)',
    hint: 'After hitting either anti-abuse limit, the user is paused for this many hours.',
  },
  insurance_dynamic_high_lev_threshold: {
    label: 'High-leverage threshold',
    hint: 'Leverage at or above this triggers the surcharge below. e.g. 200 = 1:200.',
  },
  insurance_dynamic_high_lev_surcharge: {
    label: 'High-leverage premium surcharge (×)',
    hint: 'Multiplier applied to the premium when the trade uses the high-leverage threshold. 1 = no surcharge.',
  },
  insurance_dynamic_no_sl_surcharge: {
    label: 'No-SL premium surcharge (×)',
    hint: 'Multiplier when the user opens the trade without a stop-loss. 1 = no surcharge.',
  },
  insurance_dynamic_winrate_threshold: {
    label: 'Low win-rate threshold',
    hint: 'Win rate below this triggers the surcharge. 0.4 = 40%.',
  },
  insurance_dynamic_winrate_surcharge: {
    label: 'Low win-rate premium surcharge (×)',
    hint: 'Multiplier when the user’s win rate is below the threshold. 1 = no surcharge.',
  },
  insurance_disable_atr_floor: {
    label: 'Disable ATR floor',
    hint: 'Set ON during volatile periods to skip the ATR-based minimum premium and let the base * tier scale dominate.',
  },
  insurance_news_blackout_until: {
    label: 'News blackout (JSON)',
    hint: 'ISO timestamp string OR null. While set, no policies can be opened (e.g. major-news embargo).',
  },
};

type SettingsValue = number | boolean | string | null | Record<string, unknown> | unknown[];

interface StatsWindow {
  policies_activated: number;
  claims_paid: number;
  fee_revenue: number;
  payouts: number;
  gross_margin: number;
}

interface StatsResponse {
  '24h': StatsWindow;
  '7d': StatsWindow;
  all: StatsWindow;
  top_claimants: { user_id: string; total_payout: number }[];
}

function fmtUsd(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

interface AccountGroup {
  id: string;
  name: string;
}

export default function InsuranceAdminPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [values, setValues] = useState<Record<string, SettingsValue>>({});
  const [jsonText, setJsonText] = useState<Record<string, string>>({});
  const [jsonError, setJsonError] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [accountGroups, setAccountGroups] = useState<AccountGroup[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, statsRes, groupsRes] = await Promise.all([
        adminApi.get<Record<string, SettingsValue>>('/insurance/settings'),
        adminApi.get<StatsResponse>('/insurance/stats').catch(() => null),
        adminApi
          .get<{ items?: AccountGroup[] } | AccountGroup[]>('/account-types')
          .catch(() => [] as AccountGroup[]),
      ]);
      setValues(settingsRes || {});
      if (statsRes) setStats(statsRes);
      const groups = Array.isArray(groupsRes)
        ? groupsRes
        : (groupsRes?.items || []);
      setAccountGroups(groups);

      const jt: Record<string, string> = {};
      for (const k of JSON_KEYS) {
        const v = settingsRes?.[k];
        jt[k] = v == null ? '' : JSON.stringify(v, null, 2);
      }
      setJsonText(jt);
      setJsonError({});
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load insurance settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refreshStats = async () => {
    setRefreshing(true);
    try {
      const s = await adminApi.get<StatsResponse>('/insurance/stats');
      setStats(s);
    } catch (e: any) {
      toast.error(e?.message || 'Stats refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  const setVal = (k: string, v: SettingsValue) => {
    setValues((prev) => ({ ...prev, [k]: v }));
  };

  const save = async () => {
    // Parse the JSON-shaped fields. Anything that fails to parse blocks
    // the save and surfaces a per-field error — the resolver downstream
    // would reject these silently if we shipped malformed shapes.
    const errs: Record<string, string> = {};
    const updates: Record<string, SettingsValue> = {};

    for (const k of NUMERIC_KEYS) {
      const v = values[k];
      if (v === undefined || v === null || v === '') continue;
      const n = typeof v === 'number' ? v : parseFloat(String(v));
      if (Number.isFinite(n)) updates[k] = n;
    }

    // Pricing mode + per-tier per-lot rates are handled outside the
    // NUMERIC/JSON arrays so the admin doesn't have to hand-edit JSON.
    const mode = String(values.insurance_pricing_mode || 'per_lot').toLowerCase();
    if (mode === 'per_lot' || mode === 'risk_score') {
      updates.insurance_pricing_mode = mode;
    }
    const perLot = values.insurance_per_lot_fee;
    if (perLot && typeof perLot === 'object' && !Array.isArray(perLot)) {
      const cleaned: Record<string, number> = {};
      for (const tier of ['basic', 'advanced', 'pro', 'elite']) {
        const raw = (perLot as Record<string, unknown>)[tier];
        const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
        if (Number.isFinite(n) && n >= 0) cleaned[tier] = n;
      }
      if (Object.keys(cleaned).length > 0) {
        updates.insurance_per_lot_fee = cleaned;
      }
    }

    // Per-account-group per-tier overrides — admin can pin specific
    // $/lot rates for accounts of a given group. Empty cell = inherit
    // global per_lot_fee for that tier; whole-group empty = drop the
    // override entirely.
    const byGroup = values.insurance_per_lot_fee_by_account_group;
    if (byGroup && typeof byGroup === 'object' && !Array.isArray(byGroup)) {
      const cleanedByGroup: Record<string, Record<string, number>> = {};
      for (const [gid, raw] of Object.entries(byGroup as Record<string, unknown>)) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const inner: Record<string, number> = {};
        for (const tier of ['basic', 'advanced', 'pro', 'elite']) {
          const cell = (raw as Record<string, unknown>)[tier];
          if (cell === '' || cell == null) continue;
          const n = typeof cell === 'number' ? cell : parseFloat(String(cell));
          if (Number.isFinite(n) && n >= 0) inner[tier] = n;
        }
        if (Object.keys(inner).length > 0) cleanedByGroup[gid] = inner;
      }
      updates.insurance_per_lot_fee_by_account_group = cleanedByGroup;
    }
    for (const k of BOOL_KEYS) {
      const v = values[k];
      if (typeof v === 'boolean') updates[k] = v;
    }
    for (const k of JSON_KEYS) {
      const raw = (jsonText[k] || '').trim();
      if (raw === '') {
        updates[k] = null;
        continue;
      }
      try {
        updates[k] = JSON.parse(raw);
      } catch (e: any) {
        errs[k] = e?.message || 'Invalid JSON';
      }
    }

    setJsonError(errs);
    if (Object.keys(errs).length > 0) {
      toast.error('Fix the JSON errors and try again.');
      return;
    }

    setSaving(true);
    try {
      await adminApi.put('/insurance/settings', { updates });
      toast.success('Insurance settings saved');
      load();
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

  const enabled = !!values.insurance_enabled;

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <ShieldCheck size={18} className="text-buy" /> Trade Insurance
          </h1>
          <p className="text-xxs text-text-tertiary mt-0.5 max-w-2xl">
            Every tunable the insurance engine reads at policy-open + claim time. Saves are
            applied immediately and the cache is invalidated, so live policies start paying
            the new fee on the next opened trade.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshStats}
            disabled={refreshing}
            className="p-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover disabled:opacity-50"
            title="Refresh stats"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-buy rounded-md hover:bg-buy-light disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save settings
          </button>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(['24h', '7d', 'all'] as const).map((w) => (
            <div key={w} className="bg-bg-secondary border border-border-primary rounded-md p-4">
              <div className="text-xxs text-text-tertiary uppercase tracking-wider">{w} window</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-text-tertiary">Policies</div>
                  <div className="text-text-primary font-mono tabular-nums">{stats[w].policies_activated}</div>
                </div>
                <div>
                  <div className="text-text-tertiary">Claims</div>
                  <div className="text-text-primary font-mono tabular-nums">{stats[w].claims_paid}</div>
                </div>
                <div>
                  <div className="text-text-tertiary">Fees</div>
                  <div className="text-buy font-mono tabular-nums">{fmtUsd(stats[w].fee_revenue)}</div>
                </div>
                <div>
                  <div className="text-text-tertiary">Payouts</div>
                  <div className="text-sell font-mono tabular-nums">{fmtUsd(stats[w].payouts)}</div>
                </div>
                <div className="col-span-2 mt-1 border-t border-border-primary/40 pt-1.5">
                  <div className="text-text-tertiary">Gross margin</div>
                  <div
                    className={`font-mono tabular-nums font-semibold ${
                      stats[w].gross_margin >= 0 ? 'text-buy' : 'text-sell'
                    }`}
                  >
                    {fmtUsd(stats[w].gross_margin)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Master toggle */}
      <div
        className={`rounded-md border p-4 flex flex-wrap items-center gap-3 ${
          enabled ? 'bg-buy/[0.04] border-buy/30' : 'bg-sell/[0.04] border-sell/30'
        }`}
      >
        <div className="flex-1 min-w-[260px]">
          <h2 className="text-sm font-semibold text-text-primary">{KEY_LABELS.insurance_enabled.label}</h2>
          <p className="text-xxs text-text-tertiary mt-0.5">{KEY_LABELS.insurance_enabled.hint}</p>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setVal('insurance_enabled', e.target.checked)}
            className="w-4 h-4 accent-buy"
          />
          <span className="text-xs text-text-secondary">{enabled ? 'On' : 'Off'}</span>
        </label>
      </div>

      {/* Pricing mode + per-lot rate table */}
      {(() => {
        const mode = String(values.insurance_pricing_mode || 'per_lot').toLowerCase();
        const isPerLot = mode === 'per_lot';
        const perLot = (values.insurance_per_lot_fee as Record<string, unknown> | null | undefined) || {};
        const tiers: Array<{ key: 'basic' | 'advanced' | 'pro' | 'elite'; label: string }> = [
          { key: 'basic', label: 'Basic' },
          { key: 'advanced', label: 'Advanced' },
          { key: 'pro', label: 'Pro' },
          { key: 'elite', label: 'Elite' },
        ];
        const setPerLotTier = (tier: string, raw: string) => {
          const next = { ...((values.insurance_per_lot_fee as Record<string, unknown>) || {}) };
          if (raw === '') {
            next[tier] = '';
          } else {
            const n = parseFloat(raw);
            next[tier] = Number.isFinite(n) ? n : '';
          }
          setVal('insurance_per_lot_fee', next as SettingsValue);
        };
        return (
          <div className="bg-bg-secondary border border-border-primary rounded-md">
            <div className="px-4 py-3 border-b border-border-primary">
              <h2 className="text-sm font-medium text-text-primary">Pricing mode</h2>
              <p className="text-xxs text-text-tertiary mt-0.5">
                <strong>Per-lot</strong> — fee scales linearly with the trade&apos;s lot size
                (<code className="text-text-secondary">fee = lots × rate × (1 + surcharges)</code>),
                capped by the per-trade ceilings below. This is the default and matches the
                &quot;per-lot charge&quot; behaviour traders expect on most MT brokers.
                <br />
                <strong>Risk-score (legacy)</strong> — fee uses the leverage × ATR × lot-factor
                model. A 10-lot trade barely costs more than a 1-lot trade. Keep for
                installs that already priced policies under this scheme.
              </p>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xxs text-text-tertiary uppercase tracking-wider">Mode</label>
                <div className="inline-flex rounded-md border border-border-primary overflow-hidden">
                  {(['per_lot', 'risk_score'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setVal('insurance_pricing_mode', m)}
                      className={`px-3 py-1.5 text-xs font-medium ${
                        mode === m
                          ? 'bg-buy/15 text-buy'
                          : 'text-text-secondary hover:bg-bg-hover'
                      }`}
                    >
                      {m === 'per_lot' ? 'Per-lot' : 'Risk-score'}
                    </button>
                  ))}
                </div>
              </div>

              <div className={isPerLot ? '' : 'opacity-50 pointer-events-none'}>
                <p className="text-xxs text-text-tertiary mb-2">
                  USD charged per lot, per tier. Surcharges (high-leverage, no-SL, low win-rate,
                  copy-trade) still multiply. Daily caps and per-trade ceilings still apply.
                </p>
                <div className="grid sm:grid-cols-4 gap-3">
                  {tiers.map((t) => {
                    const raw = (perLot as Record<string, unknown>)[t.key];
                    const v = raw === '' || raw == null ? '' : String(raw);
                    return (
                      <div key={t.key} className="flex flex-col gap-1">
                        <label className="text-xxs text-text-tertiary uppercase tracking-wider">
                          {t.label} ($/lot)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={v}
                          onChange={(e) => setPerLotTier(t.key, e.target.value)}
                          className="text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md font-mono tabular-nums text-text-primary"
                        />
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-text-tertiary mt-2">
                  Default rack rates: Basic $0.50 · Advanced $1.00 · Pro $1.50 · Elite $2.00.
                  Example: 5-lot trade on Pro = $7.50 before surcharges, capped at the per-trade
                  ceiling below.
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Per-account-type override table */}
      {(() => {
        const mode = String(values.insurance_pricing_mode || 'per_lot').toLowerCase();
        const isPerLot = mode === 'per_lot';
        const byGroup =
          (values.insurance_per_lot_fee_by_account_group as Record<string, Record<string, unknown>>) || {};
        const globalRates =
          (values.insurance_per_lot_fee as Record<string, unknown>) || {};
        const tiers: Array<'basic' | 'advanced' | 'pro' | 'elite'> = ['basic', 'advanced', 'pro', 'elite'];

        const setCell = (groupId: string, tier: string, raw: string) => {
          const next: Record<string, Record<string, unknown>> = {
            ...(byGroup as Record<string, Record<string, unknown>>),
          };
          const inner: Record<string, unknown> = { ...(next[groupId] || {}) };
          if (raw === '') {
            delete inner[tier];
          } else {
            const n = parseFloat(raw);
            inner[tier] = Number.isFinite(n) ? n : '';
          }
          if (Object.keys(inner).length === 0) {
            delete next[groupId];
          } else {
            next[groupId] = inner;
          }
          setVal('insurance_per_lot_fee_by_account_group', next as SettingsValue);
        };

        const clearGroup = (groupId: string) => {
          const next: Record<string, Record<string, unknown>> = {
            ...(byGroup as Record<string, Record<string, unknown>>),
          };
          delete next[groupId];
          setVal('insurance_per_lot_fee_by_account_group', next as SettingsValue);
        };

        const cellValue = (groupId: string, tier: string): string => {
          const v = (byGroup[groupId] as Record<string, unknown> | undefined)?.[tier];
          if (v === '' || v == null) return '';
          return String(v);
        };

        const globalForTier = (tier: string): string => {
          const v = (globalRates as Record<string, unknown>)[tier];
          if (v == null) return '—';
          const n = typeof v === 'number' ? v : parseFloat(String(v));
          return Number.isFinite(n) ? `$${n.toFixed(2)}` : '—';
        };

        return (
          <div className="bg-bg-secondary border border-border-primary rounded-md">
            <div className="px-4 py-3 border-b border-border-primary">
              <h2 className="text-sm font-medium text-text-primary">Per-account-type rate override</h2>
              <p className="text-xxs text-text-tertiary mt-0.5">
                Set a per-tier $/lot rate for each account type. <strong>Empty cell = inherit the
                global rate</strong> shown in the column header. Used only when pricing mode is
                <strong> Per-lot</strong>.
              </p>
            </div>

            {!isPerLot && (
              <div className="px-4 py-3 text-xxs text-text-tertiary">
                Pricing mode is currently <strong>Risk-score</strong>. Per-account-type rates
                only apply in Per-lot mode.
              </div>
            )}

            {accountGroups.length === 0 ? (
              <div className="px-4 py-6 text-xs text-text-tertiary text-center">
                No account types found. Create some in{' '}
                <a href="/account-types" className="text-buy underline">Account types</a>.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px]">
                  <thead>
                    <tr className="border-b border-border-primary bg-bg-tertiary/40">
                      <th className="text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase">
                        Account type
                      </th>
                      {tiers.map((t) => (
                        <th
                          key={t}
                          className="text-right px-3 py-2.5 text-xxs font-medium text-text-tertiary uppercase"
                        >
                          {t}
                          <div className="text-[10px] text-text-tertiary/70 font-normal normal-case mt-0.5">
                            global {globalForTier(t)}
                          </div>
                        </th>
                      ))}
                      <th className="text-right px-3 py-2.5 text-xxs font-medium text-text-tertiary uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountGroups.map((g) => {
                      const hasAny = byGroup[g.id] && Object.keys(byGroup[g.id]).length > 0;
                      return (
                        <tr key={g.id} className="border-b border-border-primary/40 hover:bg-bg-hover/30">
                          <td className="px-4 py-2 text-xs text-text-primary font-medium">
                            {g.name}
                            {hasAny && (
                              <span className="ml-2 text-[10px] text-buy">override active</span>
                            )}
                          </td>
                          {tiers.map((t) => (
                            <td key={t} className="px-3 py-1.5 text-right">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="inherit"
                                disabled={!isPerLot}
                                value={cellValue(g.id, t)}
                                onChange={(e) => setCell(g.id, t, e.target.value)}
                                className="w-20 text-xs py-1 px-2 bg-bg-input border border-border-primary rounded-md font-mono tabular-nums text-text-primary text-right disabled:opacity-50"
                              />
                            </td>
                          ))}
                          <td className="px-3 py-1.5 text-right">
                            {hasAny ? (
                              <button
                                type="button"
                                onClick={() => clearGroup(g.id)}
                                disabled={!isPerLot}
                                className="text-xxs text-text-tertiary hover:text-sell disabled:opacity-50"
                                title="Clear all overrides for this account type"
                              >
                                Reset
                              </button>
                            ) : (
                              <span className="text-xxs text-text-tertiary/40">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="text-[10px] text-text-tertiary px-4 py-2 border-t border-border-primary">
                  Example: Standard account on Pro tier with $0.40 here = $0.40 × 5 lots = $2.00
                  before surcharges. Other tiers for Standard still use the global rate unless you fill them in too.
                </p>
              </div>
            )}
          </div>
        );
      })()}

      {/* Numeric tunables */}
      <div className="bg-bg-secondary border border-border-primary rounded-md">
        <div className="px-4 py-3 border-b border-border-primary">
          <h2 className="text-sm font-medium text-text-primary">Premium &amp; caps</h2>
          <p className="text-xxs text-text-tertiary mt-0.5">
            Numbers below feed directly into the pricing function:{' '}
            <code className="text-text-secondary">premium = base * tier_multiplier * dynamic_surcharges * ATR-risk</code>,
            then capped per-trade.
          </p>
        </div>
        <div className="p-4 grid sm:grid-cols-2 gap-4">
          {NUMERIC_KEYS.map((k) => (
            <div key={k} className="flex flex-col gap-1">
              <label className="text-xxs text-text-tertiary uppercase tracking-wider">
                {KEY_LABELS[k]?.label || k}
              </label>
              <input
                type="number"
                step="any"
                value={(values[k] as number) ?? ''}
                onChange={(e) => setVal(k, e.target.value === '' ? null : parseFloat(e.target.value))}
                className="text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md font-mono tabular-nums text-text-primary"
              />
              <p className="text-[10px] text-text-tertiary">{KEY_LABELS[k]?.hint}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Boolean tunables (skip the master-toggle which has its own card above) */}
      <div className="bg-bg-secondary border border-border-primary rounded-md">
        <div className="px-4 py-3 border-b border-border-primary">
          <h2 className="text-sm font-medium text-text-primary">Toggles</h2>
        </div>
        <div className="p-4 space-y-3">
          {BOOL_KEYS.filter((k) => k !== 'insurance_enabled').map((k) => (
            <div key={k} className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <label className="text-xs text-text-secondary block">{KEY_LABELS[k]?.label || k}</label>
                <p className="text-xxs text-text-tertiary mt-0.5">{KEY_LABELS[k]?.hint}</p>
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!values[k]}
                  onChange={(e) => setVal(k, e.target.checked)}
                  className="w-4 h-4 accent-buy"
                />
                <span className="text-xs text-text-secondary">{values[k] ? 'On' : 'Off'}</span>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* JSON-shaped tunables */}
      <div className="bg-bg-secondary border border-border-primary rounded-md">
        <div className="px-4 py-3 border-b border-border-primary">
          <h2 className="text-sm font-medium text-text-primary">Structured tunables (JSON)</h2>
          <p className="text-xxs text-text-tertiary mt-0.5">
            Edit as JSON; the form parses on save and rejects malformed shapes.
            Leave blank to clear the setting.
          </p>
        </div>
        <div className="p-4 space-y-4">
          {JSON_KEYS.map((k) => (
            <div key={k} className="flex flex-col gap-1">
              <label className="text-xxs text-text-tertiary uppercase tracking-wider">
                {KEY_LABELS[k]?.label || k}
              </label>
              <textarea
                value={jsonText[k] ?? ''}
                onChange={(e) =>
                  setJsonText((prev) => ({ ...prev, [k]: e.target.value }))
                }
                rows={4}
                spellCheck={false}
                className="font-mono text-[11px] py-2 px-3 bg-bg-input border border-border-primary rounded-md text-text-primary"
                placeholder='e.g. {"basic": 1, "standard": 1.5, "premium": 2}'
              />
              {jsonError[k] && (
                <p className="text-[10px] text-sell flex items-center gap-1">
                  <AlertTriangle size={10} /> {jsonError[k]}
                </p>
              )}
              <p className="text-[10px] text-text-tertiary">{KEY_LABELS[k]?.hint}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Top claimants */}
      {stats && stats.top_claimants.length > 0 && (
        <div className="bg-bg-secondary border border-border-primary rounded-md">
          <div className="px-4 py-3 border-b border-border-primary">
            <h2 className="text-sm font-medium text-text-primary">Top claimants (lifetime)</h2>
            <p className="text-xxs text-text-tertiary mt-0.5">
              Watch list for fraud screening. Cross-check against the user&apos;s win-rate + recent
              positions before adjusting anti-abuse thresholds.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px]">
              <thead>
                <tr className="border-b border-border-primary bg-bg-tertiary/40">
                  <th className="text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase">User ID</th>
                  <th className="text-right px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase">Total payout</th>
                </tr>
              </thead>
              <tbody>
                {stats.top_claimants.map((c) => (
                  <tr key={c.user_id} className="border-b border-border-primary/40 hover:bg-bg-hover/30">
                    <td className="px-4 py-2 text-xxs font-mono text-text-secondary truncate max-w-[280px]">{c.user_id}</td>
                    <td className="px-4 py-2 text-right text-xs font-mono tabular-nums text-sell">{fmtUsd(c.total_payout)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
