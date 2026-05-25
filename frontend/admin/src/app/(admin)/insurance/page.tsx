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
  // Duration + anti-abuse
  'insurance_min_trade_duration_seconds',
  'insurance_anti_abuse_daily_claims',
  'insurance_anti_abuse_daily_payout',
  'insurance_anti_abuse_cooldown_hours',
  // Risk surcharges (still multiply on simple-tier fee)
  'insurance_dynamic_high_lev_threshold',
  'insurance_dynamic_high_lev_surcharge',
  'insurance_dynamic_no_sl_surcharge',
  'insurance_dynamic_winrate_threshold',
  'insurance_dynamic_winrate_surcharge',
  'insurance_copy_trade_surcharge',
  // Frequent-claim coverage reduction (anti-farming)
  'insurance_frequent_claim_count',
  'insurance_frequent_claim_window_days',
  'insurance_frequent_claim_coverage_reduction_pct',
  // Client-spec rules
  'insurance_policy_validity_seconds',
  'insurance_max_policies_per_day',
  'insurance_blackout_hour_start',
  'insurance_blackout_hour_end',
  'insurance_max_lots_insurable',
] as const;

const BOOL_KEYS = [
  'insurance_enabled',
  // Client-spec: claim payout goes to account.credit (tradable, not
  // withdrawable) when ON. OFF restores classic balance credit.
  'insurance_payout_to_credit',
] as const;

// JSON-shaped keys — kept as <textarea> blobs and parsed on save so admin
// has full control without us shipping a per-key custom editor for each.
const JSON_KEYS = [
  // ATR gates — both can be number-typed but we keep as JSON to allow null
  'insurance_disable_atr_floor',
  'insurance_disable_atr_ceiling',
  'insurance_news_blackout_until',
] as const;

const KEY_LABELS: Record<string, { label: string; hint: string }> = {
  insurance_enabled: {
    label: 'Trade insurance feature',
    hint: 'Master switch. Off = no new policies can be opened (existing policies still settle).',
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
  insurance_copy_trade_surcharge: {
    label: 'Copy-trade premium surcharge (×)',
    hint: 'Extra multiplier on the premium when the trade is a copy-trade. 0 = no surcharge. 0.10 = +10%.',
  },
  insurance_disable_atr_floor: {
    label: 'ATR floor (low-vol cut-off)',
    hint: 'Minimum ATR below which insurance is denied (vol_too_low). Default 0.0001.',
  },
  insurance_disable_atr_ceiling: {
    label: 'ATR ceiling (extreme-vol kill switch)',
    hint: 'Maximum ATR above which insurance is denied (vol_too_high). null = no ceiling.',
  },
  insurance_frequent_claim_count: {
    label: 'Frequent claim threshold',
    hint: 'After this many paid claims in the window below, the user\'s offered coverage is reduced.',
  },
  insurance_frequent_claim_window_days: {
    label: 'Frequent claim window (days)',
    hint: 'Lookback window for the threshold above.',
  },
  insurance_frequent_claim_coverage_reduction_pct: {
    label: 'Frequent claim coverage reduction',
    hint: 'Multiplier applied to coverage when threshold is hit. 0.25 = 25% off coverage (e.g. 50% becomes 37.5%).',
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
