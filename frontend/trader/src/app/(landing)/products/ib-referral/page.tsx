'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Users, BarChart3, Wallet, Zap, Headphones, Award, Layers, Share2,
  ChevronDown, ArrowUpRight,
} from 'lucide-react';
import { BannerPlaceholder } from '@/swisdex/components/BannerPlaceholder';

export default function IbReferralPage() {
  return (
    <main className="min-h-screen bg-background">
      <BannerPlaceholder
        title="Become an Introducing Broker"
        tagline="Refer traders to SwisDex and earn lifetime per-lot commissions — up to $15 per standard lot, paid instantly."
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
            { n: '03', icon: Wallet,   title: 'Earn on Every Lot',      body: 'Get paid weekly on every standard lot your referrals trade — across forex, crypto, indices, and commodities.' },
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

      {/* Commission tiers */}
      <section id="tiers" className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="text-center mb-10">
          <h2 className="font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">Commission Tiers</h2>
          <p className="mt-3 text-foreground/65 max-w-xl mx-auto text-sm sm:text-base">
            The more active your referrals, the higher the per-lot payout. Move up automatically — no manual upgrade.
          </p>
        </div>

        <div className="overflow-x-auto -mx-[var(--gutter)] px-[var(--gutter)]">
          <div className="min-w-[700px] rounded-2xl overflow-hidden border border-foreground/15">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className="bg-foreground/[0.04] border-r border-foreground/15 px-5 py-4 text-left text-xs uppercase tracking-[0.16em] text-foreground/55">Active Referrals</th>
                  <th className="px-5 py-4 text-center font-display uppercase tracking-[0.16em] text-sm text-white border-r border-white/10" style={{ background: 'linear-gradient(180deg, #1f2937 0%, #0a0a0a 100%)' }}>5 – 20</th>
                  <th className="px-5 py-4 text-center font-display uppercase tracking-[0.16em] text-sm text-white border-r border-white/10" style={{ background: 'linear-gradient(180deg, #55a630 0%, #1a3210 100%)' }}>21 – 100</th>
                  <th className="px-5 py-4 text-center font-display uppercase tracking-[0.16em] text-sm text-white" style={{ background: 'linear-gradient(180deg, #d00000 0%, #3d0000 100%)' }}>100+</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Per-lot commission', a: '$5 – $7',  b: '$7 – $10', c: '$12 – $15' },
                  { label: 'Payout',             a: 'Instant',  b: 'Instant',  c: 'Instant' },
                  { label: 'Dedicated manager',  a: '—',        b: '✓',        c: '✓' },
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
      </section>

      {/* Benefits grid */}
      <section id="benefits" className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="text-center mb-10">
          <h2 className="font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">Why Partner With SwisDex</h2>
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
            { icon: Share2,      title: 'Trackable Links & QR',     body: 'UTM-tagged links, custom landing pages, and QR codes for in-person and event marketing.' },
          ].map(({ icon: Icon, title, body }) => (
            <article key={title} className="liquid-glass rounded-2xl p-6">
              <div className="size-11 rounded-xl bg-primary/25 flex items-center justify-center mb-4"><Icon className="size-5 text-primary" /></div>
              <h3 className="font-display text-lg uppercase tracking-tight">{title}</h3>
              <p className="mt-2 text-sm text-foreground/65 leading-relaxed">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Application form */}
      <section id="apply" className="mx-auto max-w-[1200px] px-[var(--gutter)] py-16">
        <div className="liquid-glass-strong rounded-3xl p-6 sm:p-10 grid lg:grid-cols-2 gap-10">
          <div>
            <h2 className="font-display uppercase text-2xl sm:text-3xl tracking-tight">Apply to become an IB</h2>
            <p className="mt-3 text-foreground/65 text-sm sm:text-base max-w-md">
              Fill the short form and our partner team will reach out within 24 hours. No minimum commitment.
            </p>
            <div className="mt-6 space-y-2 text-xs text-foreground/55">
              <div>📧 partners@swisdex.com</div>
              <div>💬 Live chat — 24/7</div>
            </div>
          </div>
          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); alert('Application received. (Demo only.)'); }}
            aria-label="IB application form"
          >
            <div className="grid sm:grid-cols-2 gap-3">
              <FormField label="Full Name" name="name" type="text" required />
              <FormField label="Country"   name="country" type="text" required />
            </div>
            <FormField label="Email"      name="email"   type="email" required />
            <FormField label="Phone"      name="phone"   type="tel"   required />
            <FormField label="Expected referrals / month" name="referrals" type="number" />
            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.16em] text-foreground/55 mb-1.5 block">Tell us about your audience</span>
              <textarea
                name="audience"
                rows={3}
                className="w-full liquid-glass rounded-xl px-3.5 py-2.5 text-sm bg-transparent text-foreground placeholder:text-foreground/40 outline-none focus:ring-2 focus:ring-primary/60"
                placeholder="Social media, trading group, education business…"
              />
            </label>
            <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-primary text-white px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:opacity-90">
              Submit Application <ArrowUpRight className="size-4" />
            </button>
          </form>
        </div>
      </section>

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
                style={{ border: '1px solid rgba(85,166,48,0.35)' }}
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
            No. You can sign up as a partner directly without ever placing a trade. We do recommend opening a free demo so you understand the product you are recommending.
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
          <Link href="#apply" className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary text-white px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:opacity-90">
            Apply Now <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}

function FormField({ label, name, type, required }: { label: string; name: string; type: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.16em] text-foreground/55 mb-1.5 block">{label}{required && ' *'}</span>
      <input
        name={name}
        type={type}
        required={required}
        className="w-full liquid-glass rounded-xl px-3.5 py-2.5 text-sm bg-transparent text-foreground placeholder:text-foreground/40 outline-none focus:ring-2 focus:ring-primary/60"
      />
    </label>
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
