'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight, Users, BarChart3, Wallet, ShieldCheck, Award, Layers,
  Headphones, FileText, Target, ChevronDown,
} from 'lucide-react';
import { BannerPlaceholder } from '@/swisdex/components/BannerPlaceholder';
import { QuoteSection } from '@/swisdex/components/QuoteSection';

const SIGNUP_HREF = '/auth/register';

export default function PortfolioManagementPage() {
  return (
    <main className="min-h-screen bg-background">
      <BannerPlaceholder
        title="Portfolio Management"
        tagline="Professional asset allocation managed by verified strategists. Choose MAM for a fully managed account, or PAMM for proportional exposure to a master strategy."
      />

      {/* MAM vs PAMM comparison */}
      <section id="mam-pam" className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full liquid-glass text-[11px] uppercase tracking-[0.16em] text-foreground/70">
            <span className="size-1.5 rounded-full bg-primary" /> Two Allocation Models
          </span>
          <h2 className="mt-5 font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">MAM vs PAMM</h2>
          <p className="mt-3 text-foreground/65 max-w-xl mx-auto text-sm sm:text-base">
            Same expert managers, two ways to participate. Pick the model that fits your capital and control preferences.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <article className="liquid-glass-strong rounded-3xl p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="size-12 rounded-xl bg-primary/25 flex items-center justify-center"><Users className="size-6 text-primary" /></div>
              <div>
                <h3 className="font-display uppercase text-2xl tracking-tight">MAM</h3>
                <div className="text-[11px] uppercase tracking-[0.16em] text-foreground/55">Multi-Account Manager</div>
              </div>
            </div>
            <p className="text-foreground/75 text-sm leading-relaxed">
              A master manager trades a block account; trades are mirrored to your individual sub-account by
              lot allocation. You retain full ownership of your account — deposit, withdraw, or close any time.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm">
              {[
                'Best for: investors who want a hands-off managed account',
                'Allocation: by lot size (configurable per sub-account)',
                'Minimum: $5,000',
                'Performance fee: 25% high-water mark',
                'Monthly statement + live dashboard',
              ].map((b) => (
                <li key={b} className="flex items-start gap-2 text-foreground/70">
                  <span className="mt-1 size-1.5 rounded-full bg-primary shrink-0" />{b}
                </li>
              ))}
            </ul>
          </article>

          <article className="liquid-glass-strong rounded-3xl p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="size-12 rounded-xl bg-primary/25 flex items-center justify-center"><BarChart3 className="size-6 text-primary" /></div>
              <div>
                <h3 className="font-display uppercase text-2xl tracking-tight">PAMM</h3>
                <div className="text-[11px] uppercase tracking-[0.16em] text-foreground/55">Percentage Allocation Manager</div>
              </div>
            </div>
            <p className="text-foreground/75 text-sm leading-relaxed">
              Capital is pooled with other investors into a master strategy; gains and losses are credited to
              your sub-account proportionally to your equity share. Simpler operations, lower entry minimum.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm">
              {[
                'Best for: investors who want exposure to a top strategy at lower entry',
                'Allocation: by % of pooled equity',
                'Minimum: $1,000',
                'Performance fee: 20% high-water mark',
                'Daily NAV + transparent fee ledger',
              ].map((b) => (
                <li key={b} className="flex items-start gap-2 text-foreground/70">
                  <span className="mt-1 size-1.5 rounded-full bg-primary shrink-0" />{b}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      {/* Investor quote — Warren Buffett "make money while you sleep" */}
      <QuoteSection
        eyebrow="Why Managed Accounts"
        quote={
          <>
            &ldquo;If you don&rsquo;t find a way to{' '}
            <span className="text-primary font-bold">make money while you sleep</span>,
            you will <span className="text-primary font-bold">work until you die</span>.&rdquo;
          </>
        }
      />

      {/* Fee table */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="text-center mb-10">
          <h2 className="font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">Transparent Fees</h2>
          <p className="mt-3 text-foreground/65 max-w-xl mx-auto text-sm sm:text-base">
            No hidden costs. Performance-only fees with a high-water mark — you only pay when your account hits a new equity peak.
          </p>
        </div>
        <div className="overflow-x-auto -mx-[var(--gutter)] px-[var(--gutter)]">
          <div className="min-w-[700px] rounded-2xl overflow-hidden border border-foreground/15">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className="bg-foreground/[0.04] border-r border-foreground/15 px-5 py-4 text-left text-xs uppercase tracking-[0.16em] text-foreground/55">Fee Type</th>
                  <th className="px-5 py-4 text-center font-display uppercase tracking-[0.16em] text-sm text-white border-r border-white/10" style={{ background: 'linear-gradient(180deg, #1f2937 0%, #0a0a0a 100%)' }}>PAMM</th>
                  <th className="px-5 py-4 text-center font-display uppercase tracking-[0.16em] text-sm text-white" style={{ background: 'linear-gradient(180deg, #55a630 0%, #1a3210 100%)' }}>MAM</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Minimum deposit',     a: '$1,000',  b: '$5,000' },
                  { label: 'Management fee',      a: '0%',      b: '0%' },
                  { label: 'Performance fee',     a: '20%',     b: '25%' },
                  { label: 'High-water mark',     a: '✓',       b: '✓' },
                  { label: 'Withdrawal frequency', a: 'Monthly', b: 'Anytime' },
                  { label: 'Lock-up period',      a: '30 days', b: 'None' },
                  { label: 'Reporting',           a: 'Daily NAV', b: 'Live + Monthly statement' },
                ].map((row) => (
                  <tr key={row.label} className="border-t border-foreground/10">
                    <td className="px-5 py-4 text-sm text-foreground/75 bg-foreground/[0.04] border-r border-foreground/15">{row.label}</td>
                    <td className="px-5 py-4 text-center text-sm text-foreground/90 bg-foreground/[0.02] border-r border-foreground/10">{row.a}</td>
                    <td className="px-5 py-4 text-center text-sm text-foreground bg-primary/[0.08]">{row.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Benefits grid */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="text-center mb-10">
          <h2 className="font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">Why Choose Managed Portfolios</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: Award,      title: 'Verified Track Record',  body: 'Every manager publishes audited live performance for at least 24 months before being listed.' },
            { icon: ShieldCheck, title: 'Segregated Funds',      body: 'Your capital stays in your own sub-account. Managers can trade — they cannot withdraw.' },
            { icon: Layers,      title: 'Multi-Strategy Mix',    body: 'Allocate across several managers to diversify across style, asset class, and volatility regime.' },
            { icon: BarChart3,   title: 'Daily NAV & Reports',   body: 'Track equity, drawdown, fees, and attribution in real time. Export to CSV for your accountant.' },
            { icon: Headphones,  title: 'Dedicated Onboarding',  body: 'A relationship manager walks you through manager selection, risk profiling, and allocation.' },
            { icon: Target,      title: 'Performance-Aligned',   body: 'Managers earn only on profit above prior peak. No fee on flat or losing months — period.' },
          ].map(({ icon: Icon, title, body }) => (
            <article key={title} className="liquid-glass rounded-2xl p-6">
              <div className="size-11 rounded-xl bg-primary/25 flex items-center justify-center mb-4"><Icon className="size-5 text-primary" /></div>
              <h3 className="font-display text-lg uppercase tracking-tight">{title}</h3>
              <p className="mt-2 text-sm text-foreground/65 leading-relaxed">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* How to start */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="text-center mb-10">
          <h2 className="font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">How to Start</h2>
        </div>
        <ol className="grid sm:grid-cols-4 gap-5">
          {[
            { n: '01', icon: Wallet,   title: 'Fund Your Account', body: 'Deposit via crypto, wire, or card. Minimum $1,000 for PAMM, $5,000 for MAM.' },
            { n: '02', icon: Users,    title: 'Choose a Manager',  body: 'Filter by style, AUM, drawdown, and CAGR. Read the prospectus, then allocate.' },
            { n: '03', icon: FileText, title: 'Sign the Agreement', body: 'E-sign the limited-power-of-attorney granting trading-only rights to the manager.' },
            { n: '04', icon: BarChart3, title: 'Watch & Withdraw',  body: 'Track performance daily. Withdraw any time — anytime for MAM, monthly for PAMM.' },
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

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-[800px] px-[var(--gutter)] py-12 sm:py-16">
        <h2 className="text-center font-display uppercase text-2xl sm:text-3xl tracking-tight mb-8">FAQ</h2>
        <div className="space-y-3">
          <FaqItem q="Can the manager withdraw my funds?">
            No. The Limited Power of Attorney grants trading rights only. Deposits and withdrawals can only be
            initiated by you — managers can place trades but never move money out of your account.
          </FaqItem>
          <FaqItem q="What happens if my manager underperforms?">
            You can re-allocate at any time. PAMM allows monthly re-allocation; MAM is anytime. There are no
            penalties for changing or removing a manager.
          </FaqItem>
          <FaqItem q="How is the performance fee calculated?">
            On profits above the high-water mark only. If your account is at a new equity peak, the fee is
            charged on the gain above the prior peak. Drawdown periods carry no fee.
          </FaqItem>
          <FaqItem q="Is my capital insured?">
            Funds in segregated client accounts are held with tier-one banking partners. Each position is
            also covered by on-chain trade insurance up to the policy limit.
          </FaqItem>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pb-20">
        <div className="liquid-glass-strong rounded-3xl p-8 sm:p-12 text-center">
          <h2 className="font-display uppercase text-2xl sm:text-3xl tracking-tight">Get a Managed Account</h2>
          <p className="mt-4 text-foreground/70 max-w-xl mx-auto text-sm sm:text-base">
            Open your SwisDex account, choose MAM or PAMM, and allocate to a verified manager in under 24 hours.
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
