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
  // ── Client-spec rules ────────────────────────────────────────────
  'insurance_policy_validity_seconds',
  'insurance_max_policies_per_day',
  'insurance_blackout_hour_start',
  'insurance_blackout_hour_end',
  'insurance_max_lots_insurable',
] as const;

const BOOL_KEYS = [
  'insurance_enabled',
  'insurance_disable_atr_floor',
  // Client-spec: claim payout goes to account.credit (tradable, not
  // withdrawable) when ON. OFF restores classic balance credit.
  'insurance_payout_to_credit',
] as const;

// JSON-shaped keys — kept as <textarea> blobs and parsed on save so admin
// has full control without us shipping a per-key custom editor for each.
const JSON_KEYS = [
  'insurance_tier_multipliers',
  'insurance_max_cap_rules',
  'insurance_news_blackout_until',
  // Client-spec lot brackets — per lot-range tier pricing table.
  'insurance_lot_brackets',
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
  // ── Client-spec rules ────────────────────────────────────────────
  insurance_policy_validity_seconds: {
    label: 'Policy validity (seconds)',
    hint: 'Insurance auto-expires this many seconds AFTER activation. Trades closed after the window are denied with reason "policy_expired". 600 = 10 min. 0 = no expiry.',
  },
  insurance_max_policies_per_day: {
    label: 'Max policies per user / 24h',
    hint: 'Hard cap on how many insurance policies a single user can activate in any rolling 24-hour window. 0 = unlimited.',
  },
  insurance_blackout_hour_start: {
    label: 'Hour blackout — start (UTC hour 0-23)',
    hint: 'Inclusive. Together with the end hour below, blocks new activations during this window. Wraps midnight (e.g. start=22, end=6 = no insurance 22:00–05:59 UTC). Leave blank to disable.',
  },
  insurance_blackout_hour_end: {
    label: 'Hour blackout — end (UTC hour 0-23)',
    hint: 'Exclusive. E.g. start=10, end=11 = no insurance 10:00–10:59 UTC. Both must be set or both blank.',
  },
  insurance_max_lots_insurable: {
    label: 'Max insurable lot size',
    hint: 'Positions larger than this cannot be insured (returns 409 max_lots_exceeded). 0 = no cap. Default 0.05.',
  },
  insurance_payout_to_credit: {
    label: 'Claim payout → tradable credit',
    hint: 'When ON: claim amount is credited to account.credit (counts toward equity/margin, NOT withdrawable; cleared on user\'s first approved withdrawal). When OFF: classic real-cash credit to account.balance.',
  },
  insurance_lot_brackets: {
    label: 'Lot-size bracket pricing (JSON)',
    hint: 'When set, this REPLACES the legacy 4-tier ladder per matching lot size. Example: [{"min_lots":0.01,"max_lots":0.04,"tiers":[{"label":"50%","coverage_pct":50,"fee":1.0,"max_cap":5.0},{"label":"70%","coverage_pct":70,"fee":3.0,"max_cap":10.0}]}]. Empty array = use legacy tiers.',
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

    // Simple-mode tiers — structured form (not JSON textarea), so we
    // pass the array directly. Empty array means admin intentionally
    // cleared it; we still send it so the backend overwrites the
    // existing rows with [].
    if (Array.isArray(values.insurance_simple_tiers)) {
      const cleaned = (values.insurance_simple_tiers as Array<Record<string, unknown>>)
        .map((row) => ({
          label: String(row.label ?? '').trim(),
          coverage_pct: Number(row.coverage_pct) || 0,
          fee_per_lot: Number(row.fee_per_lot) || 0,
          max_cap_per_lot: Number(row.max_cap_per_lot) || 0,
        }))
        // Drop completely-empty rows so admin doesn't accidentally
        // ship a placeholder bracket.
        .filter((r) => r.label !== '' || r.coverage_pct > 0 || r.fee_per_lot > 0 || r.max_cap_per_lot > 0);
      updates.insurance_simple_tiers = cleaned;
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

      {/* ── SIMPLE MODE — primary control surface ──────────────────────
          Client uses simple mode: two tiers (50% / 70%), per-lot fee
          and per-lot max cap that scale linearly with lots. Editing
          here writes to system_settings.insurance_simple_tiers; engine
          picks it up on the next quote with no restart. */}
      {(() => {
        const rawSimple = values['insurance_simple_tiers'];
        const simpleTiers: Array<{
          label: string;
          coverage_pct: number;
          fee_per_lot: number;
          max_cap_per_lot: number;
        }> = Array.isArray(rawSimple)
          ? rawSimple.map((r: any) => ({
              label: String(r?.label ?? ''),
              coverage_pct: Number(r?.coverage_pct ?? 0) || 0,
              fee_per_lot: Number(r?.fee_per_lot ?? 0) || 0,
              max_cap_per_lot: Number(r?.max_cap_per_lot ?? 0) || 0,
            }))
          : [];
        const updateSimpleTier = (idx: number, patch: any) => {
          const next = simpleTiers.map((t, i) => (i === idx ? { ...t, ...patch } : t));
          setVal('insurance_simple_tiers', next as any);
        };
        const addSimpleTier = () => {
          setVal('insurance_simple_tiers', [
            ...simpleTiers,
            { label: '', coverage_pct: 50, fee_per_lot: 100, max_cap_per_lot: 500 },
          ] as any);
        };
        const removeSimpleTier = (idx: number) => {
          setVal(
            'insurance_simple_tiers',
            simpleTiers.filter((_, i) => i !== idx) as any,
          );
        };
        const loadDefaults = () => {
          setVal('insurance_simple_tiers', [
            { label: '50%', coverage_pct: 50, fee_per_lot: 100, max_cap_per_lot: 500 },
            { label: '70%', coverage_pct: 70, fee_per_lot: 300, max_cap_per_lot: 1000 },
          ] as any);
        };
        const previewLots = [0.01, 0.02, 0.05, 0.1];

        return (
          <div className="bg-bg-secondary border border-buy/40 rounded-md p-4 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <ShieldCheck size={14} className="text-buy" /> Simple Mode — Tier Editor
              </h2>
              <p className="text-xxs text-text-tertiary mt-0.5 leading-relaxed max-w-3xl">
                Two tiers (e.g. 50% / 70%) with per-lot pricing that scales linearly. Fee at 0.01 lot = fee_per_lot ÷ 100.
                When this list is non-empty it <span className="text-buy font-medium">overrides</span> the legacy 4-tier ladder and the lot-brackets table below.
                Clear the list to fall back to advanced mode.
              </p>
            </div>

            <div className="rounded-md border border-border-primary/60 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-bg-tertiary/40 border-b border-border-primary">
                    {['#', 'Label', 'Coverage %', 'Fee per lot ($)', 'Max cap per lot ($)', ''].map((h, i) => (
                      <th key={i} className="px-2 py-1.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide text-left">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {simpleTiers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center text-xxs text-text-tertiary">
                        No simple tiers configured.
                        <button
                          type="button"
                          onClick={loadDefaults}
                          className="ml-2 text-buy underline"
                        >
                          Load 50% / 70% defaults
                        </button>
                      </td>
                    </tr>
                  ) : (
                    simpleTiers.map((t, idx) => (
                      <tr key={idx} className="border-b border-border-primary/30 last:border-0">
                        <td className="px-2 py-1 text-xxs text-text-tertiary tabular-nums">{idx + 1}</td>
                        <td className="px-2 py-1">
                          <input
                            value={t.label}
                            onChange={(e) => updateSimpleTier(idx, { label: e.target.value })}
                            placeholder="50%"
                            className="w-full text-xs py-1 px-1.5 bg-bg-input border border-border-primary rounded"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number" step="0.1" min="0" max="100"
                            value={t.coverage_pct}
                            onChange={(e) => updateSimpleTier(idx, { coverage_pct: parseFloat(e.target.value) || 0 })}
                            placeholder="50"
                            className="w-full text-xs py-1 px-1.5 bg-bg-input border border-border-primary rounded font-mono"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number" step="0.01" min="0"
                            value={t.fee_per_lot}
                            onChange={(e) => updateSimpleTier(idx, { fee_per_lot: parseFloat(e.target.value) || 0 })}
                            placeholder="100"
                            className="w-full text-xs py-1 px-1.5 bg-bg-input border border-border-primary rounded font-mono"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number" step="0.01" min="0"
                            value={t.max_cap_per_lot}
                            onChange={(e) => updateSimpleTier(idx, { max_cap_per_lot: parseFloat(e.target.value) || 0 })}
                            placeholder="500"
                            className="w-full text-xs py-1 px-1.5 bg-bg-input border border-border-primary rounded font-mono"
                          />
                        </td>
                        <td className="px-2 py-1 text-right">
                          <button
                            type="button"
                            onClick={() => removeSimpleTier(idx)}
                            title="Remove tier"
                            className="text-text-tertiary hover:text-danger text-xs px-2"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {simpleTiers.length > 0 && (
              <div className="rounded-md bg-bg-tertiary/40 border border-border-primary/40 p-3">
                <p className="text-xxs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
                  Live preview — what the trader will see
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xxs">
                    <thead>
                      <tr className="text-text-tertiary border-b border-border-primary/30">
                        <th className="text-left py-1 pr-3">Lots</th>
                        {simpleTiers.map((t, i) => (
                          <th key={i} className="text-left py-1 pr-3">{t.label || `Tier ${i + 1}`}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewLots.map((lots) => (
                        <tr key={lots} className="border-b border-border-primary/20 last:border-0">
                          <td className="py-1 pr-3 font-mono">{lots}</td>
                          {simpleTiers.map((t, i) => (
                            <td key={i} className="py-1 pr-3 font-mono">
                              fee <span className="text-buy font-semibold">${(lots * t.fee_per_lot).toFixed(2)}</span>{' '}
                              · max <span className="text-text-secondary">${(lots * t.max_cap_per_lot).toFixed(2)}</span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={addSimpleTier}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border border-border-primary text-text-secondary hover:bg-bg-hover"
              >
                + Add tier
              </button>
              <p className="text-xxs text-text-tertiary">
                Save the page (top-right button) to apply.
              </p>
            </div>
          </div>
        );
      })()}

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

      {/* ── Simple Pricing card (client's preferred model) ───────────
          2 tiers, per-lot fee + per-lot max cap, scales linearly with
          lot size. When this table has rows, it overrides every legacy
          section below. */}
      {(() => {
        const tiers = (
          Array.isArray(values.insurance_simple_tiers)
            ? (values.insurance_simple_tiers as Array<Record<string, unknown>>)
            : []
        );
        const setTier = (idx: number, patch: Record<string, unknown>) => {
          const next = tiers.map((row, i) => (i === idx ? { ...row, ...patch } : row));
          setVal('insurance_simple_tiers', next as SettingsValue);
        };
        const addRow = () => {
          const next = [
            ...tiers,
            { label: '', coverage_pct: 0, fee_per_lot: 0, max_cap_per_lot: 0 },
          ];
          setVal('insurance_simple_tiers', next as SettingsValue);
        };
        const delRow = (idx: number) => {
          setVal(
            'insurance_simple_tiers',
            tiers.filter((_, i) => i !== idx) as SettingsValue,
          );
        };
        const loadDefaults = () => {
          setVal('insurance_simple_tiers', [
            { label: '50%', coverage_pct: 50, fee_per_lot: 100, max_cap_per_lot: 500 },
            { label: '70%', coverage_pct: 70, fee_per_lot: 300, max_cap_per_lot: 1000 },
          ] as SettingsValue);
        };
        const sampleLots = [0.01, 0.05, 0.1, 1];
        return (
          <div className="bg-bg-secondary border border-buy/40 rounded-md">
            <div className="px-4 py-3 border-b border-border-primary flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-buy">
                  Simple Pricing — 50% / 70% Tiers
                </h2>
                <p className="text-xxs text-text-tertiary mt-0.5 max-w-2xl">
                  When this table has any rows, it overrides every legacy section below.
                  Fee + max-cap scale <strong>linearly with lot size</strong>:
                  &nbsp;<code className="bg-bg-tertiary/60 px-1 rounded">fee = lots × fee_per_lot</code>.
                  E.g. 0.01 lot at fee_per_lot=$100 → $1 fee. 0.02 lot → $2.
                </p>
              </div>
              <button
                type="button"
                onClick={loadDefaults}
                className="text-xxs text-buy underline whitespace-nowrap shrink-0"
              >
                Load client defaults
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-bg-tertiary/30 border-b border-border-primary">
                    <th className="px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide text-left">#</th>
                    <th className="px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide text-left">Label</th>
                    <th className="px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide text-left">Coverage %</th>
                    <th className="px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide text-left">Fee / lot ($)</th>
                    <th className="px-3 py-2 text-xxs font-medium text-text-tertiary uppercase tracking-wide text-left">Max cap / lot ($)</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center text-xxs text-text-tertiary">
                        No simple tiers configured —
                        <button type="button" onClick={loadDefaults} className="ml-2 text-buy underline">
                          load defaults
                        </button>
                        &nbsp;or
                        <button type="button" onClick={addRow} className="ml-2 text-buy underline">
                          add a row manually
                        </button>.
                      </td>
                    </tr>
                  ) : (
                    tiers.map((row, idx) => (
                      <tr key={idx} className="border-b border-border-primary/30 last:border-0">
                        <td className="px-3 py-2 text-xxs text-text-tertiary tabular-nums">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={String(row.label ?? '')}
                            onChange={(e) => setTier(idx, { label: e.target.value })}
                            placeholder="e.g. 50%"
                            className="w-24 text-xs py-1 px-2 bg-bg-input border border-border-primary rounded"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number" step="0.01" min="0" max="100"
                            value={row.coverage_pct == null ? '' : String(row.coverage_pct)}
                            onChange={(e) => setTier(idx, {
                              coverage_pct: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0,
                            })}
                            placeholder="50"
                            className="w-20 text-xs py-1 px-2 bg-bg-input border border-border-primary rounded font-mono"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number" step="0.01" min="0"
                            value={row.fee_per_lot == null ? '' : String(row.fee_per_lot)}
                            onChange={(e) => setTier(idx, {
                              fee_per_lot: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0,
                            })}
                            placeholder="100"
                            className="w-24 text-xs py-1 px-2 bg-bg-input border border-border-primary rounded font-mono"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number" step="0.01" min="0"
                            value={row.max_cap_per_lot == null ? '' : String(row.max_cap_per_lot)}
                            onChange={(e) => setTier(idx, {
                              max_cap_per_lot: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0,
                            })}
                            placeholder="500"
                            className="w-24 text-xs py-1 px-2 bg-bg-input border border-border-primary rounded font-mono"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => delRow(idx)}
                            title="Remove this tier"
                            className="text-text-tertiary hover:text-danger text-xs px-2"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-2 border-t border-border-primary flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xxs text-text-secondary border border-border-primary hover:bg-bg-hover"
              >
                + Add tier
              </button>
              <p className="text-xxs text-text-tertiary">
                Click the Save button at top to persist.
              </p>
            </div>

            {/* Live preview at sample lot sizes — admin sanity-checks the
                linear scaling visually before saving. */}
            {tiers.length > 0 && (
              <div className="px-4 py-3 border-t border-border-primary bg-bg-tertiary/30">
                <p className="text-xxs font-medium text-text-tertiary uppercase tracking-wide mb-2">
                  Preview — user fee + max payout at sample lot sizes
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="px-2 py-1 text-left text-xxs text-text-tertiary">Tier</th>
                        {sampleLots.map((l) => (
                          <th key={l} className="px-2 py-1 text-right text-xxs text-text-tertiary">
                            {l} lot
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tiers.map((row, idx) => {
                        const fpl = Number(row.fee_per_lot) || 0;
                        return (
                          <tr key={`fee-${idx}`} className="border-t border-border-primary/30">
                            <td className="px-2 py-1 text-text-secondary">
                              {String(row.label || '—')}{' '}
                              <span className="text-text-tertiary">fee</span>
                            </td>
                            {sampleLots.map((l) => (
                              <td key={l} className="px-2 py-1 text-right font-mono text-text-primary">
                                ${(l * fpl).toFixed(2)}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                      {tiers.map((row, idx) => {
                        const cap = Number(row.max_cap_per_lot) || 0;
                        return (
                          <tr key={`cap-${idx}`} className="border-t border-border-primary/30">
                            <td className="px-2 py-1 text-text-secondary">
                              {String(row.label || '—')}{' '}
                              <span className="text-text-tertiary">max</span>
                            </td>
                            {sampleLots.map((l) => (
                              <td key={l} className="px-2 py-1 text-right font-mono text-buy">
                                ${(l * cap).toFixed(2)}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })()}

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
