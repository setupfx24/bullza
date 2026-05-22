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

export default function InsuranceAdminPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [values, setValues] = useState<Record<string, SettingsValue>>({});
  const [jsonText, setJsonText] = useState<Record<string, string>>({});
  const [jsonError, setJsonError] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<StatsResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, statsRes] = await Promise.all([
        adminApi.get<Record<string, SettingsValue>>('/insurance/settings'),
        adminApi.get<StatsResponse>('/insurance/stats').catch(() => null),
      ]);
      setValues(settingsRes || {});
      if (statsRes) setStats(statsRes);

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
