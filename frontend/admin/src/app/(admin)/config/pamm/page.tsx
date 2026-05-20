'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Save } from 'lucide-react';
import { adminApi } from '@/lib/api';

interface PammSettings {
  manager_min_deposit_usd: number;
  application_fee_usd: number;
  max_risk_per_trade_pct: number;
  max_drawdown_pct: number;
  max_manager_commission_pct: number;
  exclude_bonus_funds: boolean;
  dep_window_start_day: number;
  dep_window_end_day: number;
  trade_window_start_day: number;
  trade_window_end_day: number;
  annual_maintenance_pct: number;
  monthly_profit_fee_pct: number;
}

const DEFAULTS: PammSettings = {
  manager_min_deposit_usd: 1000,
  application_fee_usd: 50,
  max_risk_per_trade_pct: 5,
  max_drawdown_pct: 30,
  max_manager_commission_pct: 30,
  exclude_bonus_funds: true,
  dep_window_start_day: 1,
  dep_window_end_day: 5,
  trade_window_start_day: 6,
  trade_window_end_day: 30,
  annual_maintenance_pct: 1,
  monthly_profit_fee_pct: 2,
};

// system_settings keys we store these under. Keep in sync with
// backend/services/gateway/src/services/pamm_config_service.py.
const KEYS: Record<keyof PammSettings, string> = {
  manager_min_deposit_usd:     'pamm_manager_min_deposit_usd',
  application_fee_usd:          'pamm_application_fee_usd',
  max_risk_per_trade_pct:       'pamm_max_risk_per_trade_pct',
  max_drawdown_pct:             'pamm_max_drawdown_pct',
  max_manager_commission_pct:   'pamm_max_manager_commission_pct',
  exclude_bonus_funds:          'pamm_exclude_bonus_funds',
  dep_window_start_day:         'pamm_dep_window_start_day',
  dep_window_end_day:           'pamm_dep_window_end_day',
  trade_window_start_day:       'pamm_trade_window_start_day',
  trade_window_end_day:         'pamm_trade_window_end_day',
  annual_maintenance_pct:       'pamm_annual_maintenance_pct',
  monthly_profit_fee_pct:       'pamm_monthly_profit_fee_pct',
};

export default function PammConfigPage() {
  const [s, setS] = useState<PammSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await adminApi.get<{ key: string; value: any }[]>('/settings');
      const list = Array.isArray(all) ? all : [];
      const byKey = new Map(list.map((r) => [r.key, r.value]));
      const next: PammSettings = { ...DEFAULTS };
      (Object.keys(KEYS) as (keyof PammSettings)[]).forEach((field) => {
        const k = KEYS[field];
        if (byKey.has(k)) {
          const v = byKey.get(k);
          if (field === 'exclude_bonus_funds') {
            (next[field] as boolean) = v === true || v === 'true' || v === 1 || v === '1';
          } else {
            const n = Number(v);
            if (Number.isFinite(n)) (next[field] as number) = n;
          }
        }
      });
      setS(next);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load PAMM config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (s.dep_window_start_day < 1 || s.dep_window_end_day > 31 || s.dep_window_start_day > s.dep_window_end_day) {
      toast.error('Deposit window days must be 1–31 and start ≤ end');
      return;
    }
    if (s.trade_window_start_day < 1 || s.trade_window_end_day > 31 || s.trade_window_start_day > s.trade_window_end_day) {
      toast.error('Trade window days must be 1–31 and start ≤ end');
      return;
    }
    if (s.max_manager_commission_pct < 0 || s.max_manager_commission_pct > 100) {
      toast.error('Manager commission cap must be 0–100%');
      return;
    }
    setSaving(true);
    try {
      const settings: Record<string, unknown> = {};
      (Object.keys(KEYS) as (keyof PammSettings)[]).forEach((f) => {
        settings[KEYS[f]] = s[f];
      });
      await adminApi.put('/settings', { settings });
      toast.success('PAMM config saved');
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

  const NumField = ({ label, field, step, suffix, hint }: {
    label: string; field: keyof PammSettings; step: number; suffix?: string; hint?: string;
  }) => (
    <div>
      <label className="text-xs font-medium text-text-secondary block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step={step}
          min={0}
          value={s[field] as number}
          onChange={(e) => setS({ ...s, [field]: parseFloat(e.target.value) || 0 })}
          className="w-32 px-2 py-1.5 text-sm bg-bg-input border border-border-primary rounded font-mono tabular-nums text-text-primary"
        />
        {suffix && <span className="text-xs text-text-tertiary">{suffix}</span>}
      </div>
      {hint && <p className="text-[10px] text-text-tertiary mt-1">{hint}</p>}
    </div>
  );

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">PAMM — Platform Policy</h1>
          <p className="text-xxs text-text-tertiary mt-0.5">
            Controls every PAMM master and investor operation. Values are read at request time —
            no engine restart needed after save.
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

      <section className="bg-bg-secondary border border-border-primary rounded-md p-5 space-y-4">
        <h2 className="text-sm font-semibold text-text-primary">Manager onboarding</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <NumField label="Manager minimum deposit" field="manager_min_deposit_usd" step={50} suffix="USD"
            hint="Wallet balance required before a user can apply as a PAMM manager." />
          <NumField label="PAMM application fee" field="application_fee_usd" step={5} suffix="USD"
            hint="Charged on apply. Non-refundable on rejection." />
          <NumField label="Max manager commission cap" field="max_manager_commission_pct" step={0.5} suffix="% of profit"
            hint="Ceiling on the performance fee a manager can set when applying." />
        </div>
      </section>

      <section className="bg-bg-secondary border border-border-primary rounded-md p-5 space-y-4">
        <h2 className="text-sm font-semibold text-text-primary">Risk controls</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <NumField label="Max risk per trade" field="max_risk_per_trade_pct" step={0.1} suffix="% of pool"
            hint="Single-trade exposure cap (Phase 2: enforced in execution engine)." />
          <NumField label="Max drawdown limit" field="max_drawdown_pct" step={1} suffix="% from peak"
            hint="Auto-suspend trigger (Phase 2: enforced in monitor loop)." />
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={s.exclude_bonus_funds}
              onChange={(e) => setS({ ...s, exclude_bonus_funds: e.target.checked })}
              className="w-4 h-4 accent-buy"
            />
            <span className="text-xs text-text-secondary">
              Bonus amount cannot be used for PAMM
              <span className="block text-[10px] text-text-tertiary">
                When on, only deposited capital (not promo bonus) counts toward PAMM investments.
                Phase 2 wallet-separation work pending.
              </span>
            </span>
          </label>
        </div>
      </section>

      <section className="bg-bg-secondary border border-border-primary rounded-md p-5 space-y-4">
        <h2 className="text-sm font-semibold text-text-primary">Monthly windows</h2>
        <p className="text-[11px] text-text-tertiary">
          Day numbers are inclusive. UTC calendar day.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-xs font-medium text-text-secondary">Deposits + Withdrawals</div>
            <div className="flex items-center gap-2">
              <span className="text-xxs text-text-tertiary">Day</span>
              <input
                type="number" min={1} max={31}
                value={s.dep_window_start_day}
                onChange={(e) => setS({ ...s, dep_window_start_day: parseInt(e.target.value) || 1 })}
                className="w-16 px-2 py-1.5 text-sm bg-bg-input border border-border-primary rounded font-mono tabular-nums text-text-primary"
              />
              <span className="text-xxs text-text-tertiary">to</span>
              <input
                type="number" min={1} max={31}
                value={s.dep_window_end_day}
                onChange={(e) => setS({ ...s, dep_window_end_day: parseInt(e.target.value) || 1 })}
                className="w-16 px-2 py-1.5 text-sm bg-bg-input border border-border-primary rounded font-mono tabular-nums text-text-primary"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-medium text-text-secondary">Trading allowed</div>
            <div className="flex items-center gap-2">
              <span className="text-xxs text-text-tertiary">Day</span>
              <input
                type="number" min={1} max={31}
                value={s.trade_window_start_day}
                onChange={(e) => setS({ ...s, trade_window_start_day: parseInt(e.target.value) || 1 })}
                className="w-16 px-2 py-1.5 text-sm bg-bg-input border border-border-primary rounded font-mono tabular-nums text-text-primary"
              />
              <span className="text-xxs text-text-tertiary">to</span>
              <input
                type="number" min={1} max={31}
                value={s.trade_window_end_day}
                onChange={(e) => setS({ ...s, trade_window_end_day: parseInt(e.target.value) || 1 })}
                className="w-16 px-2 py-1.5 text-sm bg-bg-input border border-border-primary rounded font-mono tabular-nums text-text-primary"
              />
            </div>
            <p className="text-[10px] text-text-tertiary">
              Phase 2: master-side trade-blocking on out-of-window days.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-bg-secondary border border-border-primary rounded-md p-5 space-y-4">
        <h2 className="text-sm font-semibold text-text-primary">Company fees on pool</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <NumField label="Annual maintenance charge" field="annual_maintenance_pct" step={0.1} suffix="% of AUM"
            hint="Deducted yearly from pool AUM (Phase 2: scheduler)." />
          <NumField label="Monthly profit fee" field="monthly_profit_fee_pct" step={0.1} suffix="% of profit"
            hint="Company's cut of the master's monthly profit (Phase 2: scheduler)." />
        </div>
      </section>
    </div>
  );
}
