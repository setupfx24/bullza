'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Users, BarChart3, Wallet, Zap, Headphones, Award, Layers, Share2,
  ChevronDown, ArrowUpRight, Crown, Gem, Sparkles,
} from 'lucide-react';
import { BannerPlaceholder } from '@/home/components/BannerPlaceholder';
import { BRAND_NAME } from '@/lib/brand';

/**
 * IB Account Type tier grid — per the client spec sheet delivered 2026-06.
 * Was briefly hosted on the Insurance page; moved here where it belongs.
 * Each tier is gated by an "active traders" threshold and carries a
 * per-lot commission + tier reward "amount". Platinum is the entry
 * point for the custom-deal program (up to $15 / lot) called out in
 * the green callout below the grid.
 */
const IB_TIERS = [
  { tier: 'Bronze',   traders: '+5',   commission: '$5',  amount: '$500',    tone: '#cd7f32', Icon: Award },
  { tier: 'Silver',   traders: '+20',  commission: '$7',  amount: '$5,000',  tone: '#c0c0c0', Icon: Award },
  { tier: 'Gold',     traders: '+50',  commission: '$10', amount: '$20,000', tone: '#e8b923', Icon: Crown, featured: true },
  { tier: 'Platinum', traders: '+100', commission: '$12', amount: '$50,000', tone: '#e5e4e2', Icon: Gem },
];

function StatRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] uppercase tracking-[0.14em] text-foreground/55">{label}</span>
      <span
        className="font-display text-base tabular-nums"
        style={{ color: accent || '#ffffff' }}
      >
        {value}
      </span>
    </div>
  );
}

export default function IbReferralPage() {
  return (
    <main className="min-h-screen bg-background">
      <BannerPlaceholder
        title="Become an Introducing Broker"
        tagline={`Refer traders to ${BRAND_NAME} and earn lifetime per-lot commissions — up to $15 per standard lot, paid instantly.`}
      />

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-[1200px] px-[var(--gutter)] py-16 sm:py-20">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full liquid-glass text-[11px] uppercase tracking-[0.16em] text-foreground/70">
            <span className="size-1.5 rounded-full bg-primary" /> How It Works
          </span>
          <h2 className="mt-5 font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">
            Three steps. <span className="text-primary">Lifetime commissions.</span>
          </h2>
        </div>
        <ol className="grid sm:grid-cols-3 gap-5" aria-label="How the IB program works">
          {[
            { n: '01', icon: Users,    title: 'Apply & Get Approved',   body: 'Submit the IB application. Our partner team reviews and activates your account, typically within 24 hours.' },
            { n: '02', icon: Share2,   title: 'Share Your Link',        body: 'Use your unique referral link, banner kit, or QR code. Every signup is automatically tagged to you for life.' },
            { n: '03', icon: Wallet,   title: 'Earn on Every Lot',      body: 'Get paid on every standard lot your referrals trade — across forex, crypto, indices, and commodities.' },
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

      {/* IB Account Tiers — moved here from /products/insurance per client. */}
      <section id="tiers" className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full liquid-glass text-xs uppercase tracking-[0.18em] text-foreground/70 font-body">
            <Crown className="size-3.5" />
            IB Account Tiers
          </div>
          <h2 className="mt-5 font-display uppercase text-3xl sm:text-4xl md:text-5xl tracking-tight">
            Bronze. Silver. <span className="text-primary">Gold.</span> Platinum.
          </h2>
          <p className="mt-4 text-foreground/70 text-sm sm:text-base">
            Per-lot commission scales with the number of active traders you bring on.
            Move up automatically — no manual upgrade. Top earners qualify for custom
            deals up to <span className="text-primary font-semibold">$15 per lot</span>.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {IB_TIERS.map(({ tier, traders, commission, amount, tone, Icon, featured }) => (
            <div key={tier} className={`relative ${featured ? 'mt-3 lg:mt-0' : ''}`}>
              {featured && (
                <div
                  className="absolute -top-3 right-6 z-10 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shadow-lg"
                  style={{ background: tone, color: '#0a0a0a' }}
                >
                  <Sparkles className="size-3" /> Most Popular
                </div>
              )}
              <div
                className="rounded-3xl p-6 liquid-glass flex flex-col h-full"
                style={{
                  border: `1px solid ${tone}55`,
                  background: featured ? `linear-gradient(180deg, ${tone}14, transparent)` : undefined,
                }}
              >
                <div
                  className="size-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${tone}22`, border: `1px solid ${tone}55` }}
                >
                  <Icon className="size-5" style={{ color: tone }} />
                </div>

                <div className="font-display text-2xl uppercase tracking-tight" style={{ color: tone }}>
                  {tier}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-foreground/55">
                  IB Account Type
                </div>

                <div className="mt-5 pt-5 border-t border-foreground/10 space-y-3 flex-1">
                  <StatRow label="Active Traders"        value={traders} />
                  <StatRow label="Commission (per lot)"  value={commission} accent={tone} />
                  <StatRow label="Amount"                value={amount} />
                </div>

                <Link
                  href="/auth/register"
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity"
                  style={{ background: tone, color: '#0a0a0a' }}
                >
                  Apply for IB <ArrowUpRight className="size-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Top custom-deals callout */}
        <div
          className="mt-8 mx-auto max-w-3xl rounded-2xl p-5 sm:p-6 flex items-start gap-4"
          style={{
            background: 'hsl(11 79% 57% / 0.12)',
            border: '1px solid hsl(11 79% 57% / 0.45)',
          }}
        >
          <Sparkles className="size-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm sm:text-base text-foreground/85 leading-relaxed">
            <span className="font-semibold text-primary">Top custom deals up to $15 per lot.</span>{' '}
            Partners with consistent volume above the Platinum threshold can negotiate
            bespoke commission, marketing budget, and bonus structures with our partner team.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-foreground/45 max-w-2xl mx-auto">
          Tier qualification is reviewed monthly based on the active-trader count maintained
          across the prior 30 days. Commissions settle instantly to your IB wallet.
        </p>
      </section>

      {/* Benefits grid */}
      <section id="benefits" className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="text-center mb-10">
          <h2 className="font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">Why Partner With {BRAND_NAME}</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: Wallet,      title: 'High Per-Lot Payouts',     body: 'Up to $15 per standard lot — among the highest in the industry. No volume claw-back.' },
            { icon: Layers,      title: 'Multi-Tier Earnings',      body: 'Earn from your direct referrals AND from IBs you bring in. Build a network, not a sales job.' },
            { icon: Zap,         title: 'Instant Payouts',          body: 'Commissions hit your wallet the moment your referral closes a lot — no Monday queue, no holding period.' },
            { icon: BarChart3,   title: 'Real-Time Dashboard',      body: 'Live earnings, trader activity, conversion funnel, lot volume — all in one panel.' },
            { icon: Headphones,  title: 'Dedicated Manager',        body: 'Gold + Platinum partners get a named account manager and direct WhatsApp support.' },
            { icon: Award,       title: 'Marketing Kit',            body: 'Banners, landing pages, video assets, and email copy in 12 languages — ready to deploy.' },
            { icon: Users,       title: 'No Cap on Referrals',      body: 'Refer 5 traders or 50,000 — your commission per lot only goes up as you grow.' },
          ].map(({ icon: Icon, title, body }) => (
            <article key={title} className="liquid-glass rounded-2xl p-6">
              <div className="size-11 rounded-xl bg-primary/25 flex items-center justify-center mb-4"><Icon className="size-5 text-primary" /></div>
              <h3 className="font-display text-lg uppercase tracking-tight">{title}</h3>
              <p className="mt-2 text-sm text-foreground/65 leading-relaxed">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Apply form removed per client request — IB application now
          handled via the /auth/register flow + partner outreach by email. */}

      {/* Testimonials */}
      <section id="testimonials" className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <h2 className="text-center font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight mb-10">
          What our partners say
        </h2>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { name: 'Karan A.', region: 'India',          quote: 'The dashboard is exactly what I needed — I see every lot my network trades, payouts hit on Monday like clockwork.' },
            { name: 'Maria L.', region: 'Spain',          quote: 'The co-branded marketing kit saved me weeks. Conversion from my Telegram group jumped 3x within a month.' },
            { name: 'Tunde O.', region: 'Nigeria',        quote: 'Multi-tier is what changed it for me. I bring in IBs, they bring in traders, and I earn from the whole tree.' },
          ].map((t) => (
            <article key={t.name} className="liquid-glass rounded-2xl p-6">
              {/* Real partner-style photo via pravatar.cc. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://i.pravatar.cc/120?u=partner-${t.name.toLowerCase().replace(/\W+/g, '-')}`}
                alt=""
                className="size-12 rounded-full mb-4 object-cover"
                aria-hidden
                style={{ border: '1px solid rgba(232, 93, 61,0.35)' }}
              />
              <p className="text-sm text-foreground/85 leading-relaxed italic">"{t.quote}"</p>
              <div className="mt-4 pt-4 border-t border-border">
                <div className="font-display text-sm">{t.name}</div>
                <div className="text-[11px] text-foreground/55">{t.region}</div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-[800px] px-[var(--gutter)] py-12 sm:py-16">
        <h2 className="text-center font-display uppercase text-2xl sm:text-3xl tracking-tight mb-8">FAQ</h2>
        <div className="space-y-3">
          <FaqItem q="Do I need a trading account to become an IB?">
            Yes. You need a {BRAND_NAME} account to join the IB program — that's how your unique referral link, commissions, and payouts are tied to you. Opening the account is free and you don't have to place a trade; we still recommend funding a small demo so you understand the product you are recommending.
          </FaqItem>
          <FaqItem q="When are commissions paid?">
            Commissions are paid instantly — the moment your referral closes a lot, the rebate hits your wallet. Payouts go to your preferred method — crypto, bank wire, or local rails.
          </FaqItem>
          <FaqItem q="Can my referrals trade any product?">
            Yes. You earn rebates on every lot your referrals trade across forex, metals, energies, indices, and crypto.
          </FaqItem>
          <FaqItem q="What happens if my referral closes their account?">
            Your reattribution is permanent. If the same person re-opens an account later under your link, you continue to earn.
          </FaqItem>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pb-20">
        <div className="liquid-glass-strong rounded-3xl p-8 sm:p-12 text-center">
          <h2 className="font-display uppercase text-2xl sm:text-3xl tracking-tight">Start Earning This Week</h2>
          <p className="mt-4 text-foreground/70 max-w-xl mx-auto text-sm sm:text-base">
            Apply now, get approved within 24 hours, and share your first referral link today.
          </p>
          <Link href="/auth/register" className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary text-white px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:opacity-90">
            Apply Now <ArrowUpRight className="size-4" />
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
