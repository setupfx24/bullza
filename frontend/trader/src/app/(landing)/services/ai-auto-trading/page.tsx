'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight, Cpu, Activity, Zap, ShieldCheck, BarChart3,
  Layers, Brain, Gauge, ChevronDown,
} from 'lucide-react';
import { BannerPlaceholder } from '@/home/components/BannerPlaceholder';
import { BRAND_NAME } from '@/lib/brand';

const SIGNUP_HREF = '/auth/register';

export default function AiAutoTradingPage() {
  return (
    <main className="min-h-screen bg-background">
      <BannerPlaceholder
        title="AI-Driven Auto Trading"
        tagline="Our proprietary AI engine analyses thousands of market signals per second and executes trades 24/7 — verified 90% accuracy across forex and crypto."
      />

      {/* Intro */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="liquid-glass-strong rounded-3xl p-6 sm:p-10 grid lg:grid-cols-[1.2fr_1fr] gap-8 items-center">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full liquid-glass text-[11px] uppercase tracking-[0.16em] text-foreground/70">
              <span className="size-1.5 rounded-full bg-primary" /> Always-On
            </span>
            <h2 className="mt-5 font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">
              Markets never sleep. <span className="text-primary">Neither does our AI.</span>
            </h2>
            <p className="mt-4 text-foreground/70 text-sm sm:text-base leading-relaxed max-w-xl">
              Built on a multi-strategy ensemble — trend-following, mean-reversion, breakout, and volatility
              arbitrage — the {BRAND_NAME} AI engine continuously scans 40+ instruments and acts in milliseconds
              when a high-probability setup forms.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href={SIGNUP_HREF} className="inline-flex items-center gap-2 rounded-full bg-primary text-white px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:opacity-90">
                Activate AI Trading <ArrowUpRight className="size-4" />
              </Link>
              <Link href="/how-it-works" className="inline-flex items-center gap-2 rounded-full liquid-glass px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:bg-foreground/10">
                How It Works
              </Link>
            </div>
          </div>
          {/* AI / neural-network themed stock photo. Swap for branded
              dashboard art once available. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=900&q=80"
            alt="AI neural-network visualisation"
            className="rounded-2xl w-full min-h-[260px] max-h-[340px] object-cover"
            style={{ border: '1px solid hsl(99 55% 42% / 0.35)' }}
          />
        </div>
      </section>

      {/* Features grid */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="text-center mb-10">
          <h2 className="font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">What You Get</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: Brain,        title: '90% Verified Accuracy',  body: 'Independent audit of 12-month live performance — across all instruments and market conditions.' },
            { icon: Cpu,          title: 'Multi-Strategy Engine',  body: 'Trend, mean-reversion, breakout, arbitrage — the model rotates strategies based on regime detection.' },
            { icon: Activity,     title: 'Real-Time Telemetry',    body: 'See every trade, every signal score, every fill. Full transparency — nothing hidden behind a black box.' },
            { icon: ShieldCheck,  title: 'On-Chain Insurance',     body: 'Each position is policy-backed. Your insured amount is protected if the market moves against you.' },
            { icon: Gauge,        title: 'Adjustable Risk',        body: 'Conservative, balanced, or aggressive — choose the risk profile that matches your goals.' },
            { icon: BarChart3,    title: 'Auto-Rebalance',         body: 'Portfolio weights are rebalanced daily to maintain your target allocation across asset classes.' },
            { icon: Zap,          title: '25ms Execution',          body: 'Co-located servers next to major liquidity venues. Slippage measured in fractions of a pip.' },
            { icon: Layers,       title: '40+ Instruments',         body: 'Forex majors, minors, exotics, metals, indices, and top crypto pairs — all covered out of the box.' },
            { icon: ChevronDown,  title: 'Drawdown Limits',        body: 'Hard daily and total drawdown caps — the engine stops trading and alerts you before damage compounds.' },
          ].map(({ icon: Icon, title, body }) => (
            <article key={title} className="liquid-glass rounded-2xl p-6">
              <div className="size-11 rounded-xl bg-primary/25 flex items-center justify-center mb-4"><Icon className="size-5 text-primary" /></div>
              <h3 className="font-display text-lg uppercase tracking-tight">{title}</h3>
              <p className="mt-2 text-sm text-foreground/65 leading-relaxed">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Performance snapshot */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="liquid-glass-strong rounded-3xl p-6 sm:p-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="font-display uppercase text-2xl sm:text-3xl tracking-tight">12-Month Performance</h2>
              <p className="mt-2 text-foreground/60 text-sm">Audited live results — not backtested simulation.</p>
            </div>
            <span className="liquid-glass rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-foreground/65 w-fit">Updated monthly</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Win Rate',        value: '90.2%' },
              { label: 'Avg Monthly ROI', value: '8.7%' },
              { label: 'Max Drawdown',    value: '6.4%' },
              { label: 'Sharpe Ratio',    value: '2.31' },
            ].map((m) => (
              <div key={m.label} className="liquid-glass rounded-2xl p-5">
                <div className="text-[11px] uppercase tracking-[0.16em] text-foreground/55">{m.label}</div>
                <div className="mt-2 font-display text-3xl text-primary tabular-nums">{m.value}</div>
              </div>
            ))}
          </div>
          {/* TODO: Live equity-curve chart yahan aayega */}
          <div className="image-placeholder mt-6 rounded-2xl bg-foreground/[0.05] min-h-[220px] flex items-center justify-center">
            <BarChart3 className="size-12 text-foreground/30" aria-hidden />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-[800px] px-[var(--gutter)] py-12 sm:py-16">
        <h2 className="text-center font-display uppercase text-2xl sm:text-3xl tracking-tight mb-8">FAQ</h2>
        <div className="space-y-3">
          <FaqItem q="Do I need trading experience to use AI Auto Trading?">
            No. The AI handles strategy, sizing, and execution. You only choose a risk profile and a target
            allocation. Beginners are welcome — start with the demo account to watch the engine work.
          </FaqItem>
          <FaqItem q="Can I pause or override the AI?">
            Yes. The kill switch is in your dashboard. You can pause the engine, close all open positions,
            or override individual trades at any time.
          </FaqItem>
          <FaqItem q="What is the minimum deposit?">
            $500 to activate AI trading. Lower tiers are available for the standard manual platform.
          </FaqItem>
          <FaqItem q="Are returns guaranteed?">
            No. Past performance — even audited live performance — does not guarantee future returns. AI
            trading is high-conviction, not risk-free. Trade only with capital you can afford to lose.
          </FaqItem>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pb-20">
        <div className="liquid-glass-strong rounded-3xl p-8 sm:p-12 text-center">
          <h2 className="font-display uppercase text-2xl sm:text-3xl tracking-tight">Let the AI Take Over</h2>
          <p className="mt-4 text-foreground/70 max-w-xl mx-auto text-sm sm:text-base">
            Open an account, fund your wallet, and the engine starts working for you within minutes.
          </p>
          <Link href={SIGNUP_HREF} className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary text-white px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:opacity-90">
            Get Started <ArrowUpRight className="size-4" />
          </Link>
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
