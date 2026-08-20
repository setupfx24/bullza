'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight, TrendingUp, Newspaper, LineChart, FileText, Bell,
  Globe2, Calendar, ChevronDown,
} from 'lucide-react';
import { BannerPlaceholder } from '@/home/components/BannerPlaceholder';
import { BRAND_NAME } from '@/lib/brand';

const SIGNUP_HREF = '/auth/register';

export default function MarketResearchPage() {
  return (
    <main className="min-h-screen bg-background">
      <BannerPlaceholder
        title="Market Research & Analysis"
        tagline="Daily technical and fundamental briefs from senior analysts — written for traders who actually have to put on the position."
      />

      {/* Intro */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="liquid-glass-strong rounded-3xl p-6 sm:p-10 grid lg:grid-cols-[1.2fr_1fr] gap-8 items-center">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full liquid-glass text-[11px] uppercase tracking-[0.16em] text-foreground/70">
              <span className="size-1.5 rounded-full bg-primary" /> Updated Daily
            </span>
            <h2 className="mt-5 font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">
              Sharper decisions. <span className="text-primary">Backed by data.</span>
            </h2>
            <p className="mt-4 text-foreground/70 text-sm sm:text-base leading-relaxed max-w-xl">
              The {BRAND_NAME} research desk publishes a pre-market brief at 06:00 GMT, intraday updates on
              major catalysts, and a weekly outlook every Sunday. Every report includes specific
              entries, invalidation levels, and a defined risk/reward.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href={SIGNUP_HREF} className="inline-flex items-center gap-2 rounded-full bg-primary text-white px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:opacity-90">
                Get Daily Reports <ArrowUpRight className="size-4" />
              </Link>
            </div>
          </div>
          {/* Research / chart-analysis stock photo. Swap for a branded
              report mockup once available. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1554260570-9140fd3b7614?auto=format&fit=crop&w=900&q=80"
            alt="Trading charts and market analysis"
            className="rounded-2xl w-full min-h-[260px] max-h-[340px] object-cover"
            style={{ border: '1px solid hsl(99 55% 42% / 0.35)' }}
          />
        </div>
      </section>

      {/* What you get */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="text-center mb-10">
          <h2 className="font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">Research Coverage</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: Newspaper, title: 'Pre-Market Brief',     body: 'Daily 06:00 GMT — overnight moves, key levels, economic calendar, and the trade ideas being watched into the session.' },
            { icon: TrendingUp, title: 'Technical Setups',    body: 'Chart-based trade ideas with entry, stop, target, and risk/reward across forex, metals, indices, and crypto.' },
            { icon: Globe2,     title: 'Macro & Fundamentals', body: 'Central bank decisions, geopolitical risk, inflation prints, and how positioning shifts impact pricing.' },
            { icon: Bell,       title: 'Catalyst Alerts',     body: 'Real-time pushes when a major catalyst hits — non-farm payrolls, CPI, FOMC, BTC ETF flows.' },
            { icon: LineChart,  title: 'Weekly Outlook',      body: 'Sunday-evening recap and the week-ahead playbook. Big-picture themes, levels to defend, ideas to fade.' },
            { icon: Calendar,   title: 'Earnings & Events',   body: 'Curated event calendar for index and single-stock CFDs — earnings dates, ex-dividend, contract rolls.' },
          ].map(({ icon: Icon, title, body }) => (
            <article key={title} className="liquid-glass rounded-2xl p-6">
              <div className="size-11 rounded-xl bg-primary/25 flex items-center justify-center mb-4"><Icon className="size-5 text-primary" /></div>
              <h3 className="font-display text-lg uppercase tracking-tight">{title}</h3>
              <p className="mt-2 text-sm text-foreground/65 leading-relaxed">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Sample report preview */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="text-center mb-10">
          <h2 className="font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">Sample Trade Idea</h2>
          <p className="mt-3 text-foreground/65 max-w-xl mx-auto text-sm sm:text-base">
            Every published idea includes the levels and the reasoning — copy-paste ready into your platform.
          </p>
        </div>
        <div className="liquid-glass-strong rounded-3xl p-6 sm:p-8 max-w-[860px] mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-foreground/10">
            <div>
              <div className="font-display uppercase text-xl tracking-tight">EUR/USD — Range Fade</div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-foreground/55 mt-1">Published 06:00 GMT · Bias: Short</div>
            </div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/25 text-primary text-[11px] uppercase tracking-[0.16em] font-semibold">
              <span className="size-1.5 rounded-full bg-primary" /> Active
            </span>
          </div>
          <div className="grid sm:grid-cols-4 gap-4 mt-6">
            {[
              { label: 'Entry',  value: '1.0865' },
              { label: 'Stop',   value: '1.0905' },
              { label: 'Target', value: '1.0780' },
              { label: 'R/R',    value: '2.1 : 1' },
            ].map((m) => (
              <div key={m.label} className="liquid-glass rounded-xl p-4">
                <div className="text-[10px] uppercase tracking-[0.16em] text-foreground/55">{m.label}</div>
                <div className="mt-1 font-display text-xl text-foreground tabular-nums">{m.value}</div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-foreground/70 leading-relaxed">
            Pair has rejected the 1.0900 supply zone twice this week with declining momentum on the 4H RSI.
            Short bias holds while price stays under 1.0905. First target is the prior swing low at 1.0780;
            stretch target 1.0735 if EU CPI surprises soft.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-[800px] px-[var(--gutter)] py-12 sm:py-16">
        <h2 className="text-center font-display uppercase text-2xl sm:text-3xl tracking-tight mb-8">FAQ</h2>
        <div className="space-y-3">
          <FaqItem q="How do I receive the research?">
            Reports are delivered to your dashboard, via email, and as in-platform push notifications. You
            can subscribe to any combination of desks (FX, Crypto, Metals, Indices).
          </FaqItem>
          <FaqItem q="Is the research free?">
            Yes — daily briefs, weekly outlooks, and catalyst alerts are included with every funded {BRAND_NAME}
            account. There is no separate subscription fee.
          </FaqItem>
          <FaqItem q="Are these recommendations to trade?">
            No. The reports are analyst commentary and educational content. You are solely responsible for
            your own trading decisions. Always size positions to your own risk tolerance.
          </FaqItem>
          <FaqItem q="Can I see the historical track record?">
            Yes. Every published idea is archived with outcome (target hit, stop hit, manually closed) so
            you can review the desk's historical performance before subscribing.
          </FaqItem>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pb-20">
        <div className="liquid-glass-strong rounded-3xl p-8 sm:p-12 text-center">
          <h2 className="font-display uppercase text-2xl sm:text-3xl tracking-tight">Start Reading the Desk</h2>
          <p className="mt-4 text-foreground/70 max-w-xl mx-auto text-sm sm:text-base">
            Open a free account to receive tomorrow morning's pre-market brief and the rest of the week's coverage.
          </p>
          <Link href={SIGNUP_HREF} className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary text-white px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:opacity-90">
            Subscribe Free <ArrowUpRight className="size-4" />
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
