'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight, Gem, ShieldCheck, Layers, Users, Lock, Bell, Sparkles,
} from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';

export default function IcoComingSoonPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Hero with strong Coming Soon emphasis */}
      <section className="relative w-full overflow-hidden" style={{ minHeight: 'min(560px, 75vh)' }}>
        {/* TODO: ICO hero banner / particle animation yahan aayega */}
        <div
          className="image-placeholder absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(135deg, hsl(11 79% 57% / 0.18) 0%, hsl(0 0% 6%) 60%, hsl(0 100% 41% / 0.10) 100%)',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 55% at 50% 50%, transparent 0%, hsl(0 0% 6%) 90%)',
          }}
        />

        <div className="relative z-10 mx-auto max-w-[1200px] px-[var(--gutter)] pt-32 pb-16 sm:pt-44 sm:pb-24 text-center">
          {/* Animated pill */}
          <span className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-primary/25 text-primary text-[11px] uppercase tracking-[0.22em] font-semibold">
            <span className="relative inline-flex items-center justify-center">
              <span className="absolute size-2 rounded-full bg-primary opacity-75 animate-ping" />
              <span className="relative size-2 rounded-full bg-primary" />
            </span>
            Coming Soon
          </span>

          <h1 className="mt-7 font-display uppercase tracking-tight leading-[0.92] text-foreground text-4xl sm:text-6xl md:text-7xl">
            ICO & Early-Stage <br className="hidden sm:block" />
            <span className="text-primary">Investments</span>
          </h1>

          <p className="mt-6 mx-auto max-w-2xl text-foreground/70 text-sm sm:text-base md:text-lg leading-relaxed">
            Early access to promising blockchain projects, vetted by {BRAND_NAME} before they hit the wider market.
            Coming soon — join the early-access list to be notified the moment the first round opens.
          </p>

          {/* Notify form */}
          <form onSubmit={onSubmit} className="mt-9 mx-auto max-w-xl">
            {submitted ? (
              <div className="liquid-glass-strong rounded-full px-5 py-3.5 text-sm text-primary font-semibold">
                You're on the list. We'll email <span className="text-foreground">{email}</span> at launch.
              </div>
            ) : (
              <div className="liquid-glass rounded-full p-1.5 flex items-center gap-2">
                <input
                  type="email"
                  required
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-transparent px-4 py-2 text-sm text-foreground placeholder:text-foreground/40 outline-none"
                  aria-label="Email address for ICO launch notification"
                />
                <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-primary text-white px-5 py-2.5 text-sm font-semibold uppercase tracking-wider hover:opacity-90">
                  Notify Me <Bell className="size-4" />
                </button>
              </div>
            )}
            <p className="mt-3 text-[11px] text-foreground/45">
              No spam. One email at launch. You can unsubscribe with one click.
            </p>
          </form>
        </div>
      </section>

      {/* Countdown / target */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="liquid-glass-strong rounded-3xl p-6 sm:p-10">
          <div className="text-center mb-8">
            <span className="text-[11px] uppercase tracking-[0.18em] text-foreground/55">Launch</span>
            <div className="mt-2 font-display uppercase text-3xl sm:text-5xl tracking-tight text-primary">Coming Soon</div>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              { icon: ShieldCheck, title: 'Due-Diligence First', body: 'Every project undergoes a 6-stage review — team, tokenomics, audit, treasury, market fit, legal.' },
              { icon: Layers,      title: 'Multi-Stage Rounds',  body: 'Seed, private, and public tranches with transparent pricing and vesting schedules.' },
              { icon: Lock,        title: 'On-Chain Custody',    body: 'Allocations are claimed directly to your wallet — non-custodial from day one.' },
            ].map(({ icon: Icon, title, body }) => (
              <article key={title} className="liquid-glass rounded-2xl p-6">
                <div className="size-11 rounded-xl bg-primary/25 flex items-center justify-center mb-4"><Icon className="size-5 text-primary" /></div>
                <h3 className="font-display text-lg uppercase tracking-tight">{title}</h3>
                <p className="mt-2 text-sm text-foreground/65 leading-relaxed">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* What to expect */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="text-center mb-10">
          <h2 className="font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">What to Expect at Launch</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: Sparkles, title: 'Curated Projects',      body: 'Hand-picked launchpad — quality over quantity. Expect 3–6 projects per quarter, not a daily firehose.' },
            { icon: Users,    title: 'Early-Access Tiers',     body: `Loyalty-based allocation tiers. Active ${BRAND_NAME} traders get priority access and higher allocation caps.` },
            { icon: Gem,      title: 'Discounted Entry',       body: `Strategic-round pricing for ${BRAND_NAME} investors — below public-sale rates, with vesting to align incentives.` },
            { icon: ShieldCheck, title: 'Audited Contracts',   body: 'No project lists without a clean audit from a tier-one firm and a published bug-bounty programme.' },
            { icon: Lock,     title: 'Vesting Transparency',   body: 'Schedules published on-chain — see every team and investor unlock before you commit a dollar.' },
            { icon: Layers,   title: 'Secondary Liquidity',    body: 'Tokens go straight to your wallet — trade on any DEX from the moment vesting unlocks.' },
          ].map(({ icon: Icon, title, body }) => (
            <article key={title} className="liquid-glass rounded-2xl p-6">
              <div className="size-11 rounded-xl bg-primary/25 flex items-center justify-center mb-4"><Icon className="size-5 text-primary" /></div>
              <h3 className="font-display text-lg uppercase tracking-tight">{title}</h3>
              <p className="mt-2 text-sm text-foreground/65 leading-relaxed">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pb-20">
        <div className="liquid-glass-strong rounded-3xl p-8 sm:p-12 text-center">
          <h2 className="font-display uppercase text-2xl sm:text-3xl tracking-tight">Be First in Line</h2>
          <p className="mt-4 text-foreground/70 max-w-xl mx-auto text-sm sm:text-base">
            Open a {BRAND_NAME} account today — every trade you place between now and launch counts toward your
            early-access tier.
          </p>
          <Link href="/auth/register" className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary text-white px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:opacity-90">
            Open Account <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
