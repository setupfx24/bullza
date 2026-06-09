'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Calculator, ShieldCheck, Target, BookOpen, Info, ChevronDown } from 'lucide-react';
import { BannerPlaceholder } from '@/swisdex/components/BannerPlaceholder';

/* ─────────────────────────────────────────────────────────────────────
   Pip values per standard lot (100,000 units) for a USD account.
   These are simplified industry-standard approximations — good enough
   for a teaching calculator. Real pip value depends on the live rate
   of the quote currency vs. your account currency.
   ───────────────────────────────────────────────────────────────────── */
const PAIRS = [
  // Majors (USD quote → pip value = $10 per std lot)
  { symbol: 'EUR/USD', pipSize: 0.0001, pipValuePerStandardLotUSD: 10 },
  { symbol: 'GBP/USD', pipSize: 0.0001, pipValuePerStandardLotUSD: 10 },
  { symbol: 'AUD/USD', pipSize: 0.0001, pipValuePerStandardLotUSD: 10 },
  { symbol: 'NZD/USD', pipSize: 0.0001, pipValuePerStandardLotUSD: 10 },
  // JPY quote (pip = 0.01) — value depends on USD/JPY rate; ~$6.5/pip @ 155
  { symbol: 'USD/JPY', pipSize: 0.01,   pipValuePerStandardLotUSD: 6.45 },
  { symbol: 'EUR/JPY', pipSize: 0.01,   pipValuePerStandardLotUSD: 6.45 },
  { symbol: 'GBP/JPY', pipSize: 0.01,   pipValuePerStandardLotUSD: 6.45 },
  // USD base (USD/XXX) — pip value depends on quote rate; approximations
  { symbol: 'USD/CAD', pipSize: 0.0001, pipValuePerStandardLotUSD: 7.30 },
  { symbol: 'USD/CHF', pipSize: 0.0001, pipValuePerStandardLotUSD: 11.20 },
  // Minors / cross
  { symbol: 'EUR/GBP', pipSize: 0.0001, pipValuePerStandardLotUSD: 12.65 },
  { symbol: 'AUD/JPY', pipSize: 0.01,   pipValuePerStandardLotUSD: 6.45 },
];

// Account-currency → USD conversion (approximate, for teaching only).
const CURRENCY_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  INR: 0.012,
};

export default function CalculatorPage() {
  const [accountCurrency, setAccountCurrency] = useState<keyof typeof CURRENCY_TO_USD>('USD');
  const [balance, setBalance]                 = useState<number>(10000);
  const [riskPct, setRiskPct]                 = useState<number>(1);
  const [stopPips, setStopPips]               = useState<number>(30);
  const [targetPips, setTargetPips]           = useState<number>(60);
  const [pairSymbol, setPairSymbol]           = useState<string>('EUR/USD');

  const pair = PAIRS.find((p) => p.symbol === pairSymbol) ?? PAIRS[0];

  const result = useMemo(() => {
    const ccyRate           = CURRENCY_TO_USD[accountCurrency] ?? 1;
    const safeBalance       = Math.max(0, Number.isFinite(balance) ? balance : 0);
    const safeRiskPct       = Math.max(0, Math.min(100, Number.isFinite(riskPct) ? riskPct : 0));
    const safeStopPips      = Math.max(0, Number.isFinite(stopPips)   ? stopPips   : 0);
    const safeTargetPips    = Math.max(0, Number.isFinite(targetPips) ? targetPips : 0);

    // 1. Risk in account currency = balance × risk%. The previous version
    //    converted to USD and back, which introduced a tiny round-trip
    //    error for non-USD accounts (and inflated the rendered value by
    //    the conversion-rate quantisation). Compute it in account
    //    currency directly — that's what the user actually risks.
    const moneyAtRiskAccount = safeBalance * (safeRiskPct / 100);

    // 2. Convert to USD for the lot calc, since pip values are USD-quoted.
    const riskAmountUsd     = moneyAtRiskAccount * ccyRate;
    const pipValuePerLotUsd = pair.pipValuePerStandardLotUSD;

    // 3. Lot size (standard lots) = risk$ / (stopPips × pipValuePerLot$)
    const stdLotsRaw  = safeStopPips > 0 && pipValuePerLotUsd > 0
      ? riskAmountUsd / (safeStopPips * pipValuePerLotUsd)
      : 0;
    const stdLots     = Math.max(0, stdLotsRaw);
    const miniLots    = stdLots * 10;
    const microLots   = stdLots * 100;
    const positionUnits = stdLots * 100_000;

    // 4. Profit in USD then back to account currency. ccyRate ≥ 0 always.
    const profitUsd  = safeTargetPips * pipValuePerLotUsd * stdLots;
    const potentialProfitAccount = ccyRate > 0 ? profitUsd / ccyRate : 0;

    // 5. Reward-to-risk.
    const rr = safeStopPips > 0 ? safeTargetPips / safeStopPips : 0;

    return {
      stdLots,
      miniLots,
      microLots,
      positionUnits,
      moneyAtRiskAccount,
      potentialProfitAccount,
      rr,
    };
  }, [accountCurrency, balance, riskPct, stopPips, targetPips, pair]);

  const fmt = (n: number, digits = 2) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
  const ccyFmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: accountCurrency, maximumFractionDigits: 2 }).format(n);

  return (
    <main className="min-h-screen bg-background">
      <BannerPlaceholder
        title="Lot Size & Profit Calculator"
        tagline="Risk-first position sizing. Punch in your stop, set a risk %, and we'll size the trade for you."
      />

      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] py-10 sm:py-14">
        <div className="liquid-glass-strong rounded-3xl p-6 sm:p-8 mb-10">
          <p className="text-sm sm:text-base text-foreground/75 leading-relaxed max-w-3xl">
            Position sizing is the single biggest determinant of long-term trading survival. Risk a fixed
            small percentage of your account on each trade (typically <span className="text-primary font-semibold">1%–2%</span>),
            and let the math decide the lot size — not your conviction.
          </p>
        </div>

        {/* Calculator */}
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6">
          <form id="calc-form" className="liquid-glass rounded-3xl p-6 sm:p-8 space-y-5" aria-label="Position size calculator">
            <h2 className="font-display uppercase text-2xl tracking-tight flex items-center gap-2">
              <Calculator className="size-5 text-primary" /> Inputs
            </h2>

            <Field label="Account Currency">
              <select
                value={accountCurrency}
                onChange={(e) => setAccountCurrency(e.target.value as keyof typeof CURRENCY_TO_USD)}
                className="w-full liquid-glass rounded-xl px-3.5 py-2.5 text-sm bg-transparent text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
              >
                {Object.keys(CURRENCY_TO_USD).map((c) => (
                  <option key={c} value={c} className="bg-background">{c}</option>
                ))}
              </select>
            </Field>

            <Field label="Account Balance" hint={ccyFmt(balance)}>
              <input
                type="number"
                min={0}
                step={100}
                value={balance}
                onChange={(e) => setBalance(Math.max(0, Number(e.target.value) || 0))}
                className="w-full liquid-glass rounded-xl px-3.5 py-2.5 text-sm bg-transparent text-foreground tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/60"
              />
            </Field>

            <Field label={`Risk per Trade (${riskPct}%)`}>
              {/* Brand-green slider with a visible thumb. We compute the
                  fill width manually so the track shows the brand colour
                  on every browser. The fill maps the slider's full
                  0%-to-5% range so 0.1% renders ~2% filled (not 0) and
                  5% renders fully — the previous formula clipped the
                  bottom 0.1 of the range and made the meter look stuck
                  at the high end for low-risk picks. */}
              <div className="relative h-6 flex items-center">
                <div
                  aria-hidden
                  className="absolute inset-x-0 h-1.5 rounded-full bg-foreground/15"
                />
                <div
                  aria-hidden
                  className="absolute h-1.5 rounded-full bg-primary"
                  style={{ width: `${Math.min(100, (riskPct / 5) * 100)}%` }}
                />
                <input
                  type="range"
                  min={0.1}
                  max={5}
                  step={0.1}
                  value={riskPct}
                  onChange={(e) => setRiskPct(Number(e.target.value))}
                  aria-valuemin={0.1}
                  aria-valuemax={5}
                  aria-valuenow={riskPct}
                  className="risk-slider absolute inset-0 w-full h-6 appearance-none bg-transparent cursor-pointer"
                />
              </div>
              <style jsx>{`
                .risk-slider::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 20px;
                  height: 20px;
                  border-radius: 9999px;
                  background: #55a630;
                  border: 2px solid #ffffff;
                  box-shadow: 0 2px 8px rgba(85, 166, 48, 0.45);
                  cursor: grab;
                }
                .risk-slider::-webkit-slider-thumb:active { cursor: grabbing; }
                .risk-slider::-moz-range-thumb {
                  width: 20px;
                  height: 20px;
                  border-radius: 9999px;
                  background: #55a630;
                  border: 2px solid #ffffff;
                  box-shadow: 0 2px 8px rgba(85, 166, 48, 0.45);
                  cursor: grab;
                }
                .risk-slider::-moz-range-track { background: transparent; }
                .risk-slider:focus { outline: none; }
                .risk-slider:focus::-webkit-slider-thumb {
                  box-shadow: 0 0 0 4px rgba(85, 166, 48, 0.25),
                              0 2px 8px rgba(85, 166, 48, 0.45);
                }
              `}</style>
              <div className="flex justify-between text-[10px] text-foreground/45 mt-2">
                <span>0.1%</span><span>1%</span><span>2%</span><span>5%</span>
              </div>

              {/* Visual risk barometer — colour-coded zones so the user
                  can see at a glance whether their risk-per-trade is
                  Conservative, Moderate, Aggressive, or Extreme without
                  parsing the percent number. Marker glides with riskPct. */}
              <RiskGauge riskPct={riskPct} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Stop Loss (pips)">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={stopPips}
                  onChange={(e) => setStopPips(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full liquid-glass rounded-xl px-3.5 py-2.5 text-sm bg-transparent text-foreground tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/60"
                />
              </Field>
              <Field label="Target (pips)">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={targetPips}
                  onChange={(e) => setTargetPips(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full liquid-glass rounded-xl px-3.5 py-2.5 text-sm bg-transparent text-foreground tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/60"
                />
              </Field>
            </div>

            <Field label="Currency Pair">
              <select
                value={pairSymbol}
                onChange={(e) => setPairSymbol(e.target.value)}
                className="w-full liquid-glass rounded-xl px-3.5 py-2.5 text-sm bg-transparent text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
              >
                {PAIRS.map((p) => (
                  <option key={p.symbol} value={p.symbol} className="bg-background">{p.symbol}</option>
                ))}
              </select>
            </Field>
          </form>

          <div className="liquid-glass-strong rounded-3xl p-6 sm:p-8 flex flex-col gap-4" aria-live="polite">
            <h2 className="font-display uppercase text-2xl tracking-tight flex items-center gap-2">
              <Target className="size-5 text-primary" /> Recommended Position
            </h2>

            <Stat label="Standard Lots"  value={fmt(result.stdLots,   4)} accent />
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Mini Lots"  value={fmt(result.miniLots,  3)} />
              <Stat label="Micro Lots" value={fmt(result.microLots, 2)} />
            </div>
            <Stat label="Position Size (units)" value={fmt(result.positionUnits, 0)} />

            <div className="h-px bg-foreground/10 my-2" />

            <Stat label="Money at Risk"     value={ccyFmt(result.moneyAtRiskAccount)} tone="risk" />
            <Stat label="Potential Profit"  value={ccyFmt(result.potentialProfitAccount)} tone="profit" />
            <Stat label="Reward : Risk"     value={`${fmt(result.rr, 2)} : 1`} />

            <p className="mt-2 text-[11px] text-foreground/45 leading-relaxed inline-flex items-start gap-1.5">
              <Info className="size-3.5 shrink-0 mt-0.5" />
              Pip values are approximate. Always confirm with your live platform spread and rate before placing a trade.
            </p>
          </div>
        </div>

        {/* Educational cards */}
        <section id="education" className="mt-16">
          <h2 className="font-display uppercase text-2xl sm:text-3xl tracking-tight mb-6">Risk Management Essentials</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <InfoCard
              icon={ShieldCheck}
              title="The 1% Rule"
              body="Never risk more than 1% of your account on a single trade. A string of losses is then survivable — and you stay in the game long enough for your edge to play out."
            />
            <InfoCard
              icon={Target}
              title="Position Sizing First"
              body="Size from your stop, not your conviction. The market does not care how confident you feel. Let the math decide and obey it."
            />
            <InfoCard
              icon={BookOpen}
              title="Worked Example"
              body="$10,000 account · 1% risk · 30-pip stop on EUR/USD = ~0.33 standard lots. Get stopped out, lose $100. Hit a 2:1 target, make $200."
            />
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mt-16">
          <h2 className="font-display uppercase text-2xl sm:text-3xl tracking-tight mb-6">FAQ</h2>
          <div className="space-y-3">
            <Accordion q="Is this calculator accurate for live trading?">
              The formula is correct. Pip values are approximations that hold within ~5%. Always cross-check
              with your broker's live pip value and account in real time before sizing.
            </Accordion>
            <Accordion q="What is a good risk percentage?">
              Most professional traders risk between 0.5% and 1% per trade. New traders should start at the
              lower end. Anything above 2% per trade is gambling — drawdowns compound brutally.
            </Accordion>
            <Accordion q="Why does the lot size change with the pair?">
              JPY-quoted pairs use a pip size of 0.01 (vs. 0.0001), and pip value in USD depends on the rate
              of the quote currency. The calculator handles both automatically.
            </Accordion>
            <Accordion q="What is a sensible reward-to-risk ratio?">
              Aim for a minimum of 1.5 : 1 and ideally 2 : 1 or higher. Below 1 : 1 your win rate has to
              exceed 50% just to break even, before spread and commission.
            </Accordion>
          </div>
        </section>

        {/* CTA */}
        <div className="mt-16 liquid-glass-strong rounded-3xl p-8 sm:p-12 text-center">
          <h2 className="font-display uppercase text-2xl sm:text-3xl tracking-tight">Put the numbers to work</h2>
          <p className="mt-4 text-foreground/70 text-sm sm:text-base max-w-xl mx-auto">
            Practice these calculations risk-free on a SwisDex demo account — $10,000 virtual, real market spreads.
          </p>
          <Link
            href="/auth/register?type=demo"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary text-white px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:opacity-90"
          >
            Open Free Demo <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-[0.16em] text-foreground/55 flex items-center justify-between">
        {label}
        {hint && <span className="text-foreground/40 normal-case tracking-normal">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Stat({
  label, value, accent, tone,
}: { label: string; value: string; accent?: boolean; tone?: 'profit' | 'risk' }) {
  const valueClass = accent
    ? 'text-primary'
    : tone === 'profit'
      ? 'text-primary'
      : tone === 'risk'
        ? 'text-secondary'
        : 'text-foreground';
  return (
    <div className="liquid-glass rounded-xl px-4 py-3 flex items-center justify-between">
      <span className="text-xs uppercase tracking-[0.16em] text-foreground/55">{label}</span>
      <span className={`font-display tabular-nums ${accent ? 'text-2xl' : 'text-base'} ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}

function InfoCard({
  icon: Icon, title, body,
}: { icon: typeof ShieldCheck; title: string; body: string }) {
  return (
    <article className="liquid-glass rounded-2xl p-6">
      <div className="size-11 rounded-xl bg-primary/25 flex items-center justify-center mb-4">
        <Icon className="size-5 text-primary" />
      </div>
      <h3 className="font-display text-lg uppercase tracking-tight mb-2">{title}</h3>
      <p className="text-sm text-foreground/65 leading-relaxed">{body}</p>
    </article>
  );
}

/**
 * Visual risk-per-trade barometer. Splits the 0–5% slider range into four
 * zones — Safe (≤1%), Moderate (1–2%), Aggressive (2–3%), Extreme (>3%) —
 * with a moving needle showing where the user currently sits. The zone
 * boundaries match the FAQ guidance ("0.5–1% is professional, >2% is
 * gambling") so the visual + the educational copy stay in sync.
 */
function RiskGauge({ riskPct }: { riskPct: number }) {
  const clamped = Math.max(0, Math.min(5, Number.isFinite(riskPct) ? riskPct : 0));
  const pct = (clamped / 5) * 100;

  let zone: { label: string; tone: string; color: string };
  if (clamped <= 1)       zone = { label: 'Safe',        tone: 'safe',       color: '#55a630' };
  else if (clamped <= 2)  zone = { label: 'Moderate',    tone: 'moderate',   color: '#e8b923' };
  else if (clamped <= 3)  zone = { label: 'Aggressive',  tone: 'aggressive', color: '#f97316' };
  else                    zone = { label: 'Extreme',     tone: 'extreme',    color: '#d00000' };

  return (
    <div className="mt-4">
      <div
        className="relative h-2.5 rounded-full overflow-hidden"
        style={{
          background:
            'linear-gradient(to right, #55a630 0% 20%, #e8b923 20% 40%, #f97316 40% 60%, #d00000 60% 100%)',
        }}
        role="meter"
        aria-label="Risk level"
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={clamped}
      >
        {/* Needle — sits above the gradient track, scales with riskPct. */}
        <div
          aria-hidden
          className="absolute top-1/2 -translate-y-1/2 size-4 rounded-full border-2 border-white shadow-md transition-[left] duration-150 ease-out"
          style={{
            left: `calc(${pct}% - 8px)`,
            background: zone.color,
            boxShadow: `0 0 0 2px ${zone.color}40, 0 1px 3px rgba(0,0,0,0.25)`,
          }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.16em]">
        <span className="text-foreground/40">Safe</span>
        <span className="text-foreground/40">Mod</span>
        <span className="text-foreground/40">Aggr</span>
        <span className="text-foreground/40">Extreme</span>
      </div>
      <p
        className="mt-2 text-xs font-semibold"
        style={{ color: zone.color }}
      >
        {zone.label} · {clamped.toFixed(1)}%
        {clamped > 2 && (
          <span className="ml-1 text-foreground/55 normal-case font-normal">
            — above 2% per trade compounds drawdowns brutally.
          </span>
        )}
      </p>
    </div>
  );
}

function Accordion({ q, children }: { q: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="liquid-glass rounded-2xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="font-display text-base sm:text-lg uppercase tracking-tight text-foreground">{q}</span>
        <ChevronDown className={`size-5 text-foreground/55 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 text-sm text-foreground/70 leading-relaxed">{children}</div>
      )}
    </div>
  );
}
