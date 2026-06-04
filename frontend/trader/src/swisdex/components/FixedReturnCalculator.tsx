'use client';

/**
 * Fixed Return Funds — interactive calculator for the public landing page.
 * Uses the same rate matrix as FixedReturnRateTable so a marketing change
 * to either flows automatically to the other.
 *
 * Picks the closest tier ceiling and the chosen tenure, then shows the
 * payout (principal × rate). Rates are total-tenure, not annualised — same
 * contract the rate table publishes.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Calculator, ArrowUpRight, TrendingUp } from 'lucide-react';

type TierKey = '1K' | '10K' | '25K' | '50K' | '100K';
type TenureKey = 'Month' | 'Quarter' | 'Half-Year' | 'Year' | '2 Year';

const TIER_CEILINGS: Record<TierKey, number> = {
  '1K':   1_000,
  '10K':  10_000,
  '25K':  25_000,
  '50K':  50_000,
  '100K': 100_000,
};

// Same numbers as FixedReturnRateTable — keep them in sync if either moves.
const RATES: Record<TenureKey, Record<TierKey, number>> = {
  'Month':     { '1K': 0.01, '10K': 0.02, '25K': 0.025, '50K': 0.03,  '100K': 0.04  },
  'Quarter':   { '1K': 0.02, '10K': 0.03, '25K': 0.03,  '50K': 0.035, '100K': 0.045 },
  'Half-Year': { '1K': 0.03, '10K': 0.04, '25K': 0.045, '50K': 0.05,  '100K': 0.05  },
  'Year':      { '1K': 0.04, '10K': 0.05, '25K': 0.055, '50K': 0.06,  '100K': 0.055 },
  '2 Year':    { '1K': 0.05, '10K': 0.06, '25K': 0.065, '50K': 0.07,  '100K': 0.07  },
};

function resolveTier(amount: number): TierKey {
  // Pick the highest tier whose ceiling the user reaches; falls back to 1K
  // for sub-$1K deposits so the calc still shows a number instead of zero.
  if (amount >= 100_000) return '100K';
  if (amount >=  50_000) return '50K';
  if (amount >=  25_000) return '25K';
  if (amount >=  10_000) return '10K';
  return '1K';
}

const TENURES: { key: TenureKey; label: string; months: number }[] = [
  { key: 'Month',     label: '1 Month',  months: 1  },
  { key: 'Quarter',   label: '3 Months', months: 3  },
  { key: 'Half-Year', label: '6 Months', months: 6  },
  { key: 'Year',      label: '12 Months', months: 12 },
  { key: '2 Year',    label: '24 Months', months: 24 },
];

const fmtUSD = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export function FixedReturnCalculator() {
  const [amountStr, setAmountStr] = useState('10000');
  const [tenure, setTenure] = useState<TenureKey>('Year');

  const amount = useMemo(() => {
    const n = parseFloat(amountStr || '0');
    return isFinite(n) && n > 0 ? n : 0;
  }, [amountStr]);

  const tier = resolveTier(amount);
  const rate = RATES[tenure][tier];
  const returnAmount = amount * rate;
  const total = amount + returnAmount;
  const monthsForTenure = TENURES.find((t) => t.key === tenure)?.months ?? 12;
  const monthlyEquiv = returnAmount / monthsForTenure;

  return (
    <section className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
      <div className="text-center mb-10">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full liquid-glass text-[11px] uppercase tracking-[0.16em] text-foreground/70">
          <Calculator className="size-3.5" /> Fixed Return Calculator
        </span>
        <h2 className="mt-5 font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">
          Estimate Your Payout
        </h2>
        <p className="mt-3 text-foreground/65 max-w-xl mx-auto text-sm sm:text-base">
          Pick a deposit and tenure — see your fixed return at maturity.
          Rates match the table above.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="liquid-glass rounded-3xl p-6 sm:p-7">
          <label className="block">
            <span className="text-xs uppercase tracking-[0.16em] text-foreground/55">Deposit (USD)</span>
            <div className="mt-2 relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/50 text-sm">$</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="100"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="w-full rounded-xl border border-foreground/15 bg-foreground/[0.04] pl-8 pr-4 py-3 text-base tabular-nums focus:outline-none focus:border-primary/60"
                placeholder="10,000"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[1_000, 10_000, 25_000, 50_000, 100_000].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmountStr(String(v))}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    amount === v
                      ? 'border-primary/70 bg-primary/15 text-primary'
                      : 'border-foreground/15 text-foreground/70 hover:border-foreground/30'
                  }`}
                >
                  ${v >= 1000 ? `${v / 1000}K` : v}
                </button>
              ))}
            </div>
          </label>

          <fieldset className="mt-6">
            <legend className="text-xs uppercase tracking-[0.16em] text-foreground/55">Tenure</legend>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {TENURES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTenure(t.key)}
                  className={`px-2 py-2 text-xs rounded-lg border transition-colors text-center ${
                    tenure === t.key
                      ? 'border-primary/70 bg-primary/15 text-primary font-semibold'
                      : 'border-foreground/15 text-foreground/70 hover:border-foreground/30'
                  }`}
                  aria-pressed={tenure === t.key}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-6 text-xs text-foreground/50">
            Tier:{' '}
            <span className="text-foreground/80 font-semibold tabular-nums">
              ${TIER_CEILINGS[tier].toLocaleString('en-US')}+
            </span>
            {' · '}Rate: <span className="text-primary font-semibold">{(rate * 100).toFixed(2)}%</span>
          </div>
        </div>

        {/* Outputs */}
        <div className="liquid-glass-strong rounded-3xl p-6 sm:p-7">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-foreground/55">
            <TrendingUp className="size-3.5 text-primary" /> Projected payout
          </div>

          <div className="mt-3">
            <div className="text-xs uppercase tracking-wider text-foreground/55">You earn</div>
            <div className="mt-1 font-display text-4xl sm:text-5xl text-primary tabular-nums">
              {fmtUSD(returnAmount)}
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wider text-foreground/55">Total at maturity</dt>
              <dd className="mt-1 text-base font-semibold tabular-nums">{fmtUSD(total)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-foreground/55">Monthly equivalent</dt>
              <dd className="mt-1 text-base font-semibold tabular-nums">{fmtUSD(monthlyEquiv)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-foreground/55">Principal</dt>
              <dd className="mt-1 text-base tabular-nums">{fmtUSD(amount)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-foreground/55">Tenure rate</dt>
              <dd className="mt-1 text-base tabular-nums">{(rate * 100).toFixed(2)}%</dd>
            </div>
          </dl>

          <Link
            href="/auth/register"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary text-white px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:opacity-90"
          >
            Open a Plan <ArrowUpRight className="size-4" />
          </Link>
          <p className="mt-3 text-[11px] text-foreground/45 leading-relaxed">
            Estimates only — actual contract terms may vary by jurisdiction
            and KYC tier. Early withdrawal forfeits the accrued return.
          </p>
        </div>
      </div>
    </section>
  );
}
