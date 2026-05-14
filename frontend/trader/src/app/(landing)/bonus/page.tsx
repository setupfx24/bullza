'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight, Gift, Wallet, CheckCircle2, Star, Sparkles,
  Zap, ShieldCheck, Clock, ChevronDown,
} from 'lucide-react';
import { BannerPlaceholder } from '@/swisdex/components/BannerPlaceholder';

const SIGNUP_HREF = '/auth/register';

const TIERS = [
  {
    range: '$100 – $499',
    bonus: '$100',
    multiplier: 'Up to 100%',
    features: [
      'Auto-credited within minutes',
      'Tradeable on all instruments',
      'Email + chat support',
    ],
    cta: 'Deposit $100',
  },
  {
    range: '$500 – $999',
    bonus: '$300',
    multiplier: 'Up to 60%',
    features: [
      'Auto-credited within minutes',
      'Tradeable on all instruments',
      'Priority chat support',
      'Free risk-management webinar',
    ],
    cta: 'Deposit $500',
  },
  {
    range: '$1,000+',
    bonus: '$1,000',
    multiplier: '100% Match',
    popular: true,
    features: [
      'Auto-credited within minutes',
      'Tradeable on all instruments',
      'Dedicated account manager',
      'Free 1-on-1 strategy session',
      'Cashback on every trade',
    ],
    cta: 'Claim Full $1,000',
  },
];

export default function BonusPage() {
  return (
    <main className="min-h-screen bg-background">
      <BannerPlaceholder
        title="100% Welcome Bonus"
        tagline="On your first deposit — auto-credited within minutes, fully tradeable, no promo code needed."
      />

      {/* Bold heading band — "100% Bonus on Your First Deposit — Details" */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pt-8 sm:pt-10">
        <div
          className="rounded-3xl p-6 sm:p-8 text-center"
          style={{
            background:
              'linear-gradient(135deg, hsl(99 55% 42% / 0.18) 0%, hsl(0 0% 6% / 0.6) 60%, hsl(0 100% 41% / 0.12) 100%)',
            border: '1px solid hsl(99 55% 42% / 0.45)',
          }}
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/30 text-primary text-[11px] uppercase tracking-[0.22em] font-bold">
            <Sparkles className="size-3" /> Details
          </span>
          <h2 className="mt-4 font-display uppercase font-extrabold tracking-tight leading-[0.95] text-foreground text-3xl sm:text-4xl md:text-5xl">
            <span className="text-primary">100% Bonus</span> on Your First Deposit
          </h2>
          <p className="mt-3 mx-auto max-w-2xl text-foreground/75 text-sm sm:text-base">
            Full breakdown of the welcome match — tier-by-tier amounts, unlock requirements, and how to claim. Everything you need to know in one place.
          </p>
        </div>
      </section>

      {/* Intro callout */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] py-10 sm:py-14">
        <div className="liquid-glass-strong rounded-3xl p-6 sm:p-10 grid lg:grid-cols-[1.2fr_1fr] gap-8 items-center">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/25 text-primary text-[11px] uppercase tracking-[0.18em] font-semibold">
              <Sparkles className="size-3" /> Limited-Time Welcome Offer
            </span>
            <h2 className="mt-5 font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">
              Deposit more. <span className="text-primary">Trade with more.</span>
            </h2>
            <p className="mt-4 text-foreground/70 text-sm sm:text-base leading-relaxed max-w-xl">
              SwisDex matches your first deposit with bonus equity that lands in your account within minutes.
              The bigger the tier you hit, the larger the matched amount — up to a full <span className="text-primary font-semibold">$1,000</span> credited on a $1,000 deposit.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href={SIGNUP_HREF} className="inline-flex items-center gap-2 rounded-full bg-primary text-white px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:opacity-90">
                Claim Bonus <ArrowUpRight className="size-4" />
              </Link>
              <Link href="#tiers" className="inline-flex items-center gap-2 rounded-full liquid-glass px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:bg-foreground/10">
                See Tiers
              </Link>
            </div>
          </div>
          {/* TODO: Bonus illustration / coin-stack animation yahan aayega */}
          <div className="image-placeholder rounded-2xl bg-foreground/[0.06] min-h-[260px] flex items-center justify-center">
            <Gift className="size-16 text-primary/40" aria-hidden />
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section id="tiers" className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full liquid-glass text-[11px] uppercase tracking-[0.16em] text-foreground/70">
            <span className="size-1.5 rounded-full bg-primary" /> Three Bonus Tiers
          </span>
          <h2 className="mt-5 font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">Pick Your Tier</h2>
          <p className="mt-3 text-foreground/65 max-w-xl mx-auto text-sm sm:text-base">
            Your bonus is determined automatically by the size of your first deposit. No code, no opt-in — it just lands.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {TIERS.map((t) => (
            <article
              key={t.range}
              className={`relative rounded-3xl p-6 sm:p-8 flex flex-col h-full ${
                t.popular ? 'liquid-glass-strong ring-1 ring-primary/40' : 'liquid-glass'
              }`}
            >
              {t.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-white text-[10px] uppercase tracking-[0.18em] font-bold">
                  <Star className="size-3" /> Most Popular
                </span>
              )}

              <div className="text-[11px] uppercase tracking-[0.16em] text-foreground/55">Deposit</div>
              <div className="mt-1 font-display text-xl text-foreground tabular-nums">{t.range}</div>

              <div className="mt-6 pb-5 border-b border-foreground/10">
                <div className="text-[11px] uppercase tracking-[0.16em] text-foreground/55">You Get</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-display text-5xl text-primary tabular-nums">{t.bonus}</span>
                  <span className="text-xs text-foreground/55">bonus</span>
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-primary/80">{t.multiplier}</div>
              </div>

              <ul className="mt-5 space-y-2.5 text-sm text-foreground/75 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={SIGNUP_HREF}
                className={`mt-7 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold uppercase tracking-wider transition ${
                  t.popular
                    ? 'bg-primary text-white hover:opacity-90'
                    : 'liquid-glass hover:bg-foreground/10'
                }`}
              >
                {t.cta} <ArrowUpRight className="size-4" />
              </Link>
            </article>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-foreground/45 max-w-2xl mx-auto leading-relaxed">
          Bonus is credited as tradeable equity on your first qualifying deposit only. Standard programme terms apply.
        </p>
      </section>

      {/* Comparison table */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="text-center mb-10">
          <h2 className="font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">Bonus Side-by-Side</h2>
        </div>
        <div className="overflow-x-auto -mx-[var(--gutter)] px-[var(--gutter)]">
          <div className="min-w-[700px] rounded-2xl overflow-hidden border border-foreground/15">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className="bg-foreground/[0.04] border-r border-foreground/15 px-5 py-4 text-left text-xs uppercase tracking-[0.16em] text-foreground/55">
                    Deposit Range
                  </th>
                  <th className="px-5 py-4 text-center font-display uppercase tracking-[0.16em] text-sm text-white border-r border-white/10"
                    style={{ background: 'linear-gradient(180deg, #1f2937 0%, #0a0a0a 100%)' }}>
                    $100 – $499
                  </th>
                  <th className="px-5 py-4 text-center font-display uppercase tracking-[0.16em] text-sm text-white border-r border-white/10"
                    style={{ background: 'linear-gradient(180deg, #2c3e50 0%, #0e1418 100%)' }}>
                    $500 – $999
                  </th>
                  <th className="px-5 py-4 text-center font-display uppercase tracking-[0.16em] text-sm text-white"
                    style={{ background: 'linear-gradient(180deg, #55a630 0%, #1a3210 100%)' }}>
                    $1,000+ ★
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Bonus credited',     a: '$100',          b: '$300',          c: '$1,000' },
                  { label: 'Match rate',         a: 'Up to 100%',    b: 'Up to 60%',     c: '100%' },
                  { label: 'Dedicated manager',  a: '—',             b: '—',             c: '✓' },
                  { label: 'Strategy session',   a: '—',             b: '—',             c: '✓' },
                  { label: 'Trade cashback',     a: '—',             b: '—',             c: '✓' },
                  { label: 'Support',            a: 'Email + chat',  b: 'Priority chat', c: 'Account manager' },
                ].map((row) => (
                  <tr key={row.label} className="border-t border-foreground/10">
                    <td className="px-5 py-4 text-sm text-foreground/75 bg-foreground/[0.04] border-r border-foreground/15">{row.label}</td>
                    <td className="px-5 py-4 text-center text-sm text-foreground/90 bg-foreground/[0.02] border-r border-foreground/10">{row.a}</td>
                    <td className="px-5 py-4 text-center text-sm text-foreground/90 bg-foreground/[0.02] border-r border-foreground/10">{row.b}</td>
                    <td className="px-5 py-4 text-center text-sm text-foreground bg-primary/[0.08]">{row.c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="text-center mb-10">
          <h2 className="font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">How to Claim</h2>
          <p className="mt-3 text-foreground/65 max-w-xl mx-auto text-sm sm:text-base">
            Four simple steps — no promo codes, no support tickets, no waiting.
          </p>
        </div>
        <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { n: '01', icon: Wallet,      title: 'Open Account',    body: 'Sign up in under 3 minutes. KYC verification is automated and usually completes within 24 hours.' },
            { n: '02', icon: Gift,        title: 'Make First Deposit', body: 'Deposit at least $100 via crypto, wire, or card. Tier is set automatically based on amount.' },
            { n: '03', icon: Zap,         title: 'Bonus Credited',   body: 'Matching bonus lands in your bonus-equity balance within minutes — no manual claim needed.' },
            { n: '04', icon: CheckCircle2, title: 'Trade & Withdraw', body: 'Use the bonus equity to open positions. Withdraw your profits at any time — no holding period.' },
          ].map(({ n, icon: Icon, title, body }) => (
            <li key={n} className="liquid-glass rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <span className="font-display text-4xl text-primary/70">{n}</span>
                <div className="size-11 rounded-xl bg-primary/25 flex items-center justify-center"><Icon className="size-5 text-primary" /></div>
              </div>
              <h3 className="mt-4 font-display text-lg uppercase tracking-tight">{title}</h3>
              <p className="mt-2 text-sm text-foreground/65 leading-relaxed">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Why our bonus is different */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="text-center mb-10">
          <h2 className="font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">Why This Bonus Is Different</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: Zap,         title: 'Instant Credit',          body: 'No 5-day approval. Bonus lands in your account within minutes of your deposit clearing.' },
            { icon: CheckCircle2, title: 'Fully Tradeable',         body: 'Use the bonus equity on any instrument — forex, crypto, indices, metals. No restrictions.' },
            { icon: ShieldCheck, title: 'Transparent Terms',       body: 'Plain-English programme terms. Bonus status and equity are visible in your dashboard from day one.' },
            { icon: Clock,       title: 'No Time Pressure',         body: 'No 30-day deadline games. Take the time you need to trade the unlock volume responsibly.' },
            { icon: Sparkles,    title: 'No Promo Codes',          body: 'Tier is set automatically by deposit size. No emails to chase, no codes to remember.' },
            { icon: Gift,        title: 'Stacks With Loyalty',      body: 'Welcome bonus stacks on top of ongoing loyalty rewards, referral commissions, and trade cashback.' },
          ].map(({ icon: Icon, title, body }) => (
            <article key={title} className="liquid-glass rounded-2xl p-6">
              <div className="size-11 rounded-xl bg-primary/25 flex items-center justify-center mb-4"><Icon className="size-5 text-primary" /></div>
              <h3 className="font-display text-lg uppercase tracking-tight">{title}</h3>
              <p className="mt-2 text-sm text-foreground/65 leading-relaxed">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-[800px] px-[var(--gutter)] py-12 sm:py-16">
        <h2 className="text-center font-display uppercase text-2xl sm:text-3xl tracking-tight mb-8">FAQ</h2>
        <div className="space-y-3">
          <FaqItem q="Do I need a promo code?">
            No. The welcome bonus is applied automatically based on the size of your first deposit. Deposit
            $100 → $100 bonus; $500 → $300; $1,000 or more → full $1,000 match.
          </FaqItem>
          <FaqItem q="Can I withdraw the bonus immediately?">
            Your profits from trading the bonus are withdrawable at any time. The bonus equity itself
            is subject to the standard programme terms shown in your dashboard.
          </FaqItem>
          <FaqItem q="What happens if I deposit more than once?">
            The welcome bonus applies only to your first qualifying deposit. Subsequent deposits are eligible
            for loyalty rewards and reload promotions, which run separately.
          </FaqItem>
          <FaqItem q="Which deposit methods qualify?">
            All standard methods qualify: crypto (BTC, ETH, USDT, USDC), bank wire, Visa/Mastercard, Skrill,
            Neteller, and supported local options. Internal transfers between SwisDex accounts do not qualify.
          </FaqItem>
          <FaqItem q="What if I lose the bonus on a trade?">
            Bonus equity absorbs losses first — your deposited capital is protected ahead of bonus. If the
            bonus is fully consumed by losses, your principal is untouched.
          </FaqItem>
          <FaqItem q="Can the bonus be combined with other promotions?">
            Yes. The welcome bonus stacks with the ongoing referral program, loyalty rewards, and trade
            cashback. It cannot be combined with one-time competitor-switch offers.
          </FaqItem>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pb-20">
        <div className="liquid-glass-strong rounded-3xl p-8 sm:p-12 text-center">
          <h2 className="font-display uppercase text-2xl sm:text-3xl tracking-tight">Claim Your Bonus Today</h2>
          <p className="mt-4 text-foreground/70 max-w-xl mx-auto text-sm sm:text-base">
            Open your SwisDex account, make your first deposit, and the matching bonus is in your balance within minutes.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href={SIGNUP_HREF} className="inline-flex items-center gap-2 rounded-full bg-primary text-white px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:opacity-90">
              Open Account <ArrowUpRight className="size-4" />
            </Link>
            <Link href="#tiers" className="inline-flex items-center gap-2 rounded-full liquid-glass px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:bg-foreground/10">
              Review Tiers
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function FaqItem({ q, children }: { q: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="liquid-glass rounded-2xl">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left">
        <span className="font-display text-base sm:text-lg uppercase tracking-tight">{q}</span>
        <ChevronDown className={`size-5 text-foreground/55 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-5 pb-5 text-sm text-foreground/70 leading-relaxed">{children}</div>}
    </div>
  );
}
