'use client';

/**
 * Trade Insurance — public marketing surface.
 *
 * The IB Account Tiers grid that briefly lived here has been moved to
 * the IB referral page (/products/ib-referral) where it belongs. This
 * page pitches Insurance: hero banner, value props, the two coverage
 * tiers (50% Standard / 70% Premium promo — both share the same bullet
 * list, only the cover % and promo flag differ), and a CTA. Exact
 * premiums/caps are still confirmed on the order ticket at activation.
 */
import Link from 'next/link';
import { ArrowUpRight, ShieldCheck, Zap, Lock, ScrollText, Check } from 'lucide-react';

// Two coverage tiers shown on the order ticket. Per the client, both cards
// carry the SAME bullet list — only the headline cover % and the promo flag
// differ between Standard (50%) and Premium (70%).
const COVER_BULLETS = [
  'Higher policy caps for verified accounts',
  'Same one-click activation, no paperwork',
  'Stackable with the welcome bonus on first deposits',
];
const COVER_TIERS = [
  {
    pct: '50%',
    label: 'Standard Cover',
    sub: 'From 2% of trade size',
    promo: false,
    bullets: ['Refunds up to 50% of any covered losing trade', ...COVER_BULLETS],
  },
  {
    pct: '70%',
    label: 'Premium Cover (Promo)',
    sub: 'Limited-time offer',
    promo: true,
    bullets: ['Refunds up to 70% of any covered losing trade', ...COVER_BULLETS],
  },
];

const FEATURES = [
  {
    Icon: ShieldCheck,
    title: 'On-Chain Policy Backing',
    body: 'Every covered position is backed by an on-chain insurance contract. Eligible losses are claimable — once approved, the payout is credited to your account as tradable funds.',
  },
  {
    Icon: Zap,
    title: 'One-Click Activation',
    body: 'Toggle Insurance on the order ticket as you place the trade. Premium is deducted at fill, cover is live the same second.',
  },
  {
    Icon: Lock,
    title: 'Claimable Tradable Credit',
    body: 'If your covered trade closes at a loss within the policy terms, file a claim from your account. Once approved the payout is issued as a credit — tradable only (usable on new positions), not directly withdrawable as cash.',
  },
  {
    Icon: ScrollText,
    title: 'Transparent Terms',
    body: 'Cover percentage, premium, cap, and minimum trade duration are all shown on the order ticket before you opt in.',
  },
];

export default function InsurancePage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero banner */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pt-24 sm:pt-28">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/insurance_banner1.png"
          alt="SwisDex Trade Insurance — protect every position"
          className="w-full rounded-3xl max-h-[420px] object-cover"
          style={{ border: '1px solid rgba(255,255,255,0.06)' }}
        />
      </section>

      {/* Intro */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full liquid-glass text-xs uppercase tracking-[0.18em] text-foreground/70 font-body">
            <ShieldCheck className="size-3.5" />
            Trade Insurance
          </div>
          <h2 className="mt-5 font-display uppercase text-3xl sm:text-4xl md:text-5xl tracking-tight">
            Protect every <span className="text-primary">position</span>.
          </h2>
          <p className="mt-4 text-foreground/70 text-sm sm:text-base leading-relaxed">
            Activate Insurance on the order ticket and, if your covered trade closes at a loss
            within the policy terms, file a claim — once approved, the payout is credited to your
            account as tradable funds. On-chain, transparent, and live the moment you fund the
            premium.
          </p>
        </div>

        {/* Features */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map(({ Icon, title, body }) => (
            <article key={title} className="liquid-glass rounded-2xl p-6 flex flex-col gap-4">
              <div className="size-11 rounded-xl bg-primary/25 flex items-center justify-center">
                <Icon className="size-5 text-primary" />
              </div>
              <h3 className="font-display text-lg uppercase tracking-tight">{title}</h3>
              <p className="text-sm text-foreground/65 leading-relaxed">{body}</p>
            </article>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-foreground/45 max-w-2xl mx-auto leading-relaxed">
          Insurance premiums apply per trade and are non-refundable. Coverage percentages, caps, and
          minimum trade durations are shown on the order ticket at activation time and may change
          without notice.
        </p>
      </section>

      {/* Coverage tiers */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pb-12 sm:pb-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="font-display uppercase text-2xl sm:text-3xl tracking-tight">Coverage Tiers</h2>
          <p className="mt-3 text-foreground/65 text-sm sm:text-base leading-relaxed">
            Activate insurance on the order ticket and get a refund if your trade closes at a loss.
            Two coverage tiers — pick the one that fits your risk.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5 max-w-4xl mx-auto">
          {COVER_TIERS.map((t) => (
            <article
              key={t.label}
              className={`relative liquid-glass rounded-2xl p-7 flex flex-col border ${
                t.promo ? 'border-[#e8b923]/40' : 'border-primary/30'
              }`}
            >
              {t.promo && (
                <span className="absolute top-5 right-5 inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#e8b923]/15 text-[#e8b923]">
                  Limited Promo
                </span>
              )}
              <div className="flex items-baseline gap-2">
                <span className={`font-display text-5xl ${t.promo ? 'text-[#e8b923]' : 'text-primary'}`}>
                  {t.pct}
                </span>
                <span className="text-xs uppercase tracking-wider text-foreground/55">loss cover</span>
              </div>
              <h3 className="mt-3 font-display text-lg uppercase tracking-tight">{t.label}</h3>
              <p className="text-[11px] uppercase tracking-wider text-foreground/45">{t.sub}</p>
              <ul className="mt-5 space-y-2.5 flex-1">
                {t.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-foreground/75">
                    <Check className={`size-4 mt-0.5 shrink-0 ${t.promo ? 'text-[#e8b923]' : 'text-primary'}`} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/register"
                className={`mt-6 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold uppercase tracking-wider transition ${
                  t.promo
                    ? 'bg-[#e8b923] text-black hover:opacity-90'
                    : 'bg-primary text-white hover:opacity-90'
                }`}
              >
                Activate Now <ArrowUpRight className="size-4" />
              </Link>
            </article>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-foreground/45 max-w-2xl mx-auto leading-relaxed">
          Insurance fees apply per trade and are non-refundable. Coverage payouts are subject to
          minimum trade duration and the policy terms shown on the order ticket at activation time.
        </p>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pb-20">
        <div className="liquid-glass-strong rounded-3xl p-8 sm:p-12 text-center">
          <h2 className="font-display uppercase text-2xl sm:text-3xl tracking-tight">
            Trade With Built-In Protection
          </h2>
          <p className="mt-4 text-foreground/70 max-w-xl mx-auto text-sm sm:text-base">
            Open a SwisDex account and tap Insurance on any order to lock in cover for that trade.
          </p>
          <Link
            href="/auth/register"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary text-white px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:opacity-90"
          >
            Open Account <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
