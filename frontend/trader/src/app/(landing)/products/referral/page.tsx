'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight, Users, Zap, Wallet, CheckCircle2, ChevronDown,
} from 'lucide-react';
import { BannerPlaceholder } from '@/swisdex/components/BannerPlaceholder';

const SIGNUP_HREF = '/auth/register';

export default function ReferralPage() {
  return (
    <main className="min-h-screen bg-background">
      <BannerPlaceholder
        title="Referral Program"
        tagline="Share your link, earn instantly. Per-referral payouts that scale with your volume — paid the moment your friend qualifies."
      />

      {/* Intro */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="liquid-glass-strong rounded-3xl p-6 sm:p-10 grid lg:grid-cols-[1.2fr_1fr] gap-8 items-center">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full liquid-glass text-[11px] uppercase tracking-[0.16em] text-foreground/70">
              <span className="size-1.5 rounded-full bg-primary" /> Instant Per-Referral Bounty
            </span>
            <h2 className="mt-5 font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">
              Refer. Activate. <span className="text-primary">Get Paid Instantly.</span>
            </h2>
            <p className="mt-4 text-foreground/70 text-sm sm:text-base leading-relaxed max-w-xl">
              Every time a friend signs up with your link, activates their account, and places their first 3 trades,
              you receive a one-time referral bounty straight to your wallet. No waiting. No claw-back. The more
              referrals you bring, the higher the per-referral payout.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href={SIGNUP_HREF} className="inline-flex items-center gap-2 rounded-full bg-primary text-white px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:opacity-90">
                Get Your Link <ArrowUpRight className="size-4" />
              </Link>
              <Link href="#tiers" className="inline-flex items-center gap-2 rounded-full liquid-glass px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:bg-foreground/10">
                See Payouts
              </Link>
            </div>
          </div>
          {/* Plain black box placeholder — drop the final Referral illustration here */}
          <div className="image-placeholder rounded-2xl min-h-[260px]" aria-hidden />
        </div>
      </section>

      {/* Referral payout tiers */}
      <section id="tiers" className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="text-center mb-10">
          <h2 className="font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">Per-Referral Payouts</h2>
          <p className="mt-3 text-foreground/65 max-w-xl mx-auto text-sm sm:text-base">
            Move up the ladder automatically as your active referrals grow — no manual upgrade.
          </p>
        </div>

        <div className="overflow-x-auto -mx-[var(--gutter)] px-[var(--gutter)]">
          <div className="min-w-[640px] rounded-2xl overflow-hidden border border-foreground/15">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className="bg-foreground/[0.04] border-r border-foreground/15 px-5 py-4 text-left text-xs uppercase tracking-[0.16em] text-foreground/55">
                    Active Referrals
                  </th>
                  <th className="px-5 py-4 text-center font-display uppercase tracking-[0.16em] text-sm text-white border-r border-white/10"
                    style={{ background: 'linear-gradient(180deg, #1f2937 0%, #0a0a0a 100%)' }}>5 – 20</th>
                  <th className="px-5 py-4 text-center font-display uppercase tracking-[0.16em] text-sm text-white border-r border-white/10"
                    style={{ background: 'linear-gradient(180deg, #55a630 0%, #1a3210 100%)' }}>21 – 100</th>
                  <th className="px-5 py-4 text-center font-display uppercase tracking-[0.16em] text-sm text-white"
                    style={{ background: 'linear-gradient(180deg, #d00000 0%, #3d0000 100%)' }}>100+</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Per-referral bounty', a: '$5',      b: '$7',      c: '$10'     },
                  { label: 'Payout',              a: 'Instant', b: 'Instant', c: 'Instant' },
                ].map((row) => (
                  <tr key={row.label} className="border-t border-foreground/10">
                    <td className="px-5 py-4 text-sm text-foreground/75 bg-foreground/[0.04] border-r border-foreground/15">{row.label}</td>
                    <td className="px-5 py-4 text-center text-sm text-foreground/90 bg-foreground/[0.02] border-r border-foreground/10">{row.a}</td>
                    <td className="px-5 py-4 text-center text-sm text-foreground bg-primary/[0.08] border-r border-foreground/10">{row.b}</td>
                    <td className="px-5 py-4 text-center text-sm text-foreground/90 bg-foreground/[0.02]">{row.c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-foreground/45 max-w-2xl mx-auto leading-relaxed">
          The "Active Referrals" tier counts friends who have completed activation and the minimum-trade requirement
          (see Terms below). The higher tier auto-applies as soon as you cross the threshold.
        </p>
      </section>

      {/* Terms & Conditions */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="liquid-glass-strong rounded-3xl p-6 sm:p-10 max-w-3xl mx-auto">
          <div className="text-center mb-6">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/25 text-primary text-[11px] uppercase tracking-[0.18em] font-semibold">
              Terms &amp; Conditions
            </span>
            <h2 className="mt-4 font-display uppercase text-2xl sm:text-3xl tracking-tight">
              How a Referral Qualifies
            </h2>
            <p className="mt-3 text-foreground/65 text-sm sm:text-base">
              Two simple requirements — both must be met for a referral to count and trigger your payout.
            </p>
          </div>
          <ol className="grid sm:grid-cols-2 gap-4">
            {[
              { n: '1', title: 'Activation of user',  body: 'Your friend signs up via your referral link, completes KYC verification, and funds their account.' },
              { n: '2', title: 'Minimum 3 trades',    body: 'Your friend places at least 3 trades after activation. The moment the 3rd trade closes, your bounty is paid instantly.' },
            ].map((t) => (
              <li key={t.n} className="liquid-glass rounded-2xl p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="font-display text-4xl text-primary/70">{t.n}</span>
                  <CheckCircle2 className="size-5 text-primary" aria-hidden />
                </div>
                <h3 className="mt-3 font-display text-lg uppercase tracking-tight">{t.title}</h3>
                <p className="mt-2 text-sm text-foreground/65 leading-relaxed">{t.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Why refer */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="text-center mb-10">
          <h2 className="font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">Why Refer Friends to SwisDex</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: Zap,    title: 'Instant Payout',     body: 'No weekly batching, no holding period. The bounty hits your wallet the moment your referral completes 3 trades.' },
            { icon: Users,  title: 'No Cap on Referrals', body: 'Refer 5 or 5,000 friends — your per-referral payout only goes up as you grow.' },
            { icon: Wallet, title: 'Stacks With IB',     body: 'If you upgrade to the IB partner programme later, your existing referrals stay credited to you for life.' },
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
          <FaqItem q="How do I get my referral link?">
            Open a SwisDex account, head to the Dashboard → Referrals tab, and your unique link is ready to copy
            and share. You can also generate QR codes and tracked landing pages from the same screen.
          </FaqItem>
          <FaqItem q="When do I get paid?">
            The moment your referred friend completes their 3rd trade after activation, the bounty for that
            referral is paid instantly to your SwisDex wallet. You can withdraw it immediately or use it as
            trading equity.
          </FaqItem>
          <FaqItem q="What counts as an active referral for the tier ladder?">
            Any referral that has cleared both T&amp;C conditions (activated account + minimum 3 trades).
            Once you have 21+ active referrals, every subsequent referral pays $7 instead of $5. At 100+
            actives, the per-referral payout jumps to $10.
          </FaqItem>
          <FaqItem q="What's the difference between Referral and IB?">
            Referral pays a one-time bounty per qualifying friend. IB (Introducing Broker) pays a recurring
            per-lot commission on every trade your network places, for life. You can run both side-by-side.
          </FaqItem>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pb-20">
        <div className="liquid-glass-strong rounded-3xl p-8 sm:p-12 text-center">
          <h2 className="font-display uppercase text-2xl sm:text-3xl tracking-tight">Start Earning From Day One</h2>
          <p className="mt-4 text-foreground/70 max-w-xl mx-auto text-sm sm:text-base">
            Open a SwisDex account, grab your referral link, and share it with one friend today.
            Their first $5 bounty could land in your wallet by the end of the week.
          </p>
          <Link href={SIGNUP_HREF} className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary text-white px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:opacity-90">
            Open Account <ArrowUpRight className="size-4" />
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
