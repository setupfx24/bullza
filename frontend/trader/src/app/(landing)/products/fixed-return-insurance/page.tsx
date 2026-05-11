'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck, TrendingUp, Calendar, Lock, FileCheck, Scale,
  ChevronDown, ArrowUpRight, Info,
} from 'lucide-react';
import { BannerPlaceholder } from '@/swisdex/components/BannerPlaceholder';

export default function FixedReturnInsurancePage() {
  return (
    <main className="min-h-screen bg-background">
      <BannerPlaceholder
        title="Fixed Return Insurance"
        tagline="Capital-protected, fixed-yield plans for the part of your portfolio that needs to sleep at night."
      />

      {/* Key features */}
      <section id="features" className="mx-auto max-w-[1200px] px-[var(--gutter)] py-16 sm:py-20">
        <div className="text-center mb-12">
          <h2 className="font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">
            <span className="text-primary">Capital protection</span> meets a fixed yield
          </h2>
          <p className="mt-4 text-foreground/65 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
            A regulated, third-party-underwritten product. Lock in a known return for a fixed tenure;
            withdraw your principal in full at maturity. Built for risk-averse capital allocations.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: ShieldCheck, title: 'Capital Protection',       body: 'Your principal is segregated and underwritten by a Tier-1 insurance counterparty. Returned in full at maturity.' },
            { icon: TrendingUp,  title: 'Fixed Returns',             body: 'A clearly stated annual yield — no surprises, no last-look. What you sign up for is what you receive.' },
            { icon: Calendar,    title: 'Flexible Tenure',           body: 'Choose 6 months, 12 months, or 24 months. Longer tenures earn higher yields.' },
            { icon: Lock,        title: 'Segregated Accounts',       body: 'Funds are held separately from SwisDex operating capital, in regulated bank custody.' },
            { icon: FileCheck,   title: 'Regulatory Compliance',     body: 'AML / KYC verified. Compliant with relevant financial market authorities in our operating jurisdictions.' },
            { icon: Scale,       title: 'Transparent Terms',         body: 'Plain-English contract. No hidden fees, no auto-renewal traps. Mature, withdraw, or roll — your call.' },
          ].map(({ icon: Icon, title, body }) => (
            <article key={title} className="liquid-glass rounded-2xl p-6">
              <div className="size-11 rounded-xl bg-primary/25 flex items-center justify-center mb-4"><Icon className="size-5 text-primary" /></div>
              <h3 className="font-display text-lg uppercase tracking-tight">{title}</h3>
              <p className="mt-2 text-sm text-foreground/65 leading-relaxed">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Plan comparison */}
      <section id="plans" className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="text-center mb-10">
          <h2 className="font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">Plan Comparison</h2>
          <p className="mt-3 text-foreground/65 max-w-xl mx-auto text-sm sm:text-base">
            Three tenures. Same capital protection. Pick the timeline that fits your goals.
          </p>
        </div>

        <div className="overflow-x-auto -mx-[var(--gutter)] px-[var(--gutter)]">
          <div className="min-w-[700px] rounded-2xl overflow-hidden border border-foreground/15">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className="bg-foreground/[0.04] border-r border-foreground/15 px-5 py-4 text-left text-xs uppercase tracking-[0.16em] text-foreground/55">Feature</th>
                  <th className="px-5 py-4 text-center font-display uppercase tracking-[0.16em] text-sm text-white border-r border-white/10" style={{ background: 'linear-gradient(180deg, #1f2937 0%, #0a0a0a 100%)' }}>6 Months</th>
                  <th className="px-5 py-4 text-center font-display uppercase tracking-[0.16em] text-sm text-white border-r border-white/10" style={{ background: 'linear-gradient(180deg, #55a630 0%, #1a3210 100%)' }}>12 Months</th>
                  <th className="px-5 py-4 text-center font-display uppercase tracking-[0.16em] text-sm text-white" style={{ background: 'linear-gradient(180deg, #d00000 0%, #3d0000 100%)' }}>24 Months</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Annualised return', a: '6.5% p.a.', b: '8.5% p.a.', c: '10.0% p.a.' },
                  { label: 'Minimum investment', a: '$1,000',   b: '$2,500',    c: '$5,000' },
                  { label: 'Capital protection', a: '100%',     b: '100%',      c: '100%' },
                  { label: 'Payout cycle',       a: 'At maturity', b: 'Quarterly + maturity', c: 'Quarterly + maturity' },
                  { label: 'Early withdrawal',   a: 'Not available', b: 'After 6 months · fee applies', c: 'After 12 months · fee applies' },
                  { label: 'Auto-renewal',       a: 'Optional', b: 'Optional', c: 'Optional' },
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

      {/* How it works timeline */}
      <section id="how" className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <h2 className="text-center font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight mb-12">
          How It Works
        </h2>
        <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5" aria-label="Investment lifecycle">
          {[
            { n: '01', title: 'Apply',         body: 'Submit a short application with KYC documents. Approval typically within 24 hours.' },
            { n: '02', title: 'Fund the Plan', body: 'Transfer your principal via bank wire, card, or crypto. Funds enter the segregated trust account.' },
            { n: '03', title: 'Quarterly Updates', body: 'Receive performance statements and (where applicable) quarterly yield payouts.' },
            { n: '04', title: 'Mature & Withdraw', body: 'At the end of the tenure, your principal plus the fixed return is wired back to your account.' },
          ].map(({ n, title, body }) => (
            <li key={n} className="liquid-glass rounded-2xl p-6">
              <span className="font-display text-4xl text-primary/70">{n}</span>
              <h3 className="mt-4 font-display text-lg uppercase tracking-tight">{title}</h3>
              <p className="mt-2 text-sm text-foreground/65 leading-relaxed">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Risk disclosure */}
      <section id="risk-disclosure" className="mx-auto max-w-[1200px] px-[var(--gutter)] py-10">
        <div className="liquid-glass-strong rounded-3xl p-6 sm:p-8">
          <h2 className="font-display uppercase text-lg sm:text-xl tracking-tight inline-flex items-center gap-2">
            <Info className="size-5 text-secondary" /> Risk Disclosure & Regulatory Notice
          </h2>
          <div className="mt-4 text-xs sm:text-sm text-foreground/65 leading-relaxed space-y-3">
            <p>
              Fixed Return Insurance plans are underwritten by independent, regulated insurance counterparties.
              Capital protection refers to the contractual obligation of the underwriter at maturity, subject
              to the underwriter's solvency and the terms of the policy.
            </p>
            <p>
              Stated yields are <strong className="text-foreground/85">indicative net returns</strong> before
              applicable taxes in your jurisdiction. Early withdrawal, where permitted, may incur fees and is
              not a guaranteed feature of every plan.
            </p>
            <p>
              These plans are <strong className="text-foreground/85">not bank deposits</strong> and are not
              covered by deposit-insurance schemes. They are insurance-wrapped investment products with
              specific risk factors. Past performance does not guarantee future returns.
            </p>
            <p>
              SwisDex Ltd is a distributor and does not provide individual financial advice. Please review
              the full plan documents and, where appropriate, consult a regulated advisor before investing.
            </p>
          </div>
        </div>
      </section>

      {/* Application form */}
      <section id="apply" className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="liquid-glass-strong rounded-3xl p-6 sm:p-10 grid lg:grid-cols-2 gap-10">
          <div>
            <h2 className="font-display uppercase text-2xl sm:text-3xl tracking-tight">Apply for a Plan</h2>
            <p className="mt-3 text-foreground/65 text-sm sm:text-base max-w-md">
              Provide a few details and our investment team will follow up within one business day with the full plan documents.
            </p>
            <div className="mt-6 space-y-2 text-xs text-foreground/55">
              <div>📧 fixedreturn@swisdex.com</div>
              <div>💬 Live chat — 24/5</div>
            </div>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); alert('Application received. (Demo only.)'); }}
            className="space-y-4"
            aria-label="Plan application form"
          >
            <div className="grid sm:grid-cols-2 gap-3">
              <FormField label="Full Name" name="name" type="text" required />
              <FormField label="Country"   name="country" type="text" required />
            </div>
            <FormField label="Email"  name="email"  type="email" required />
            <FormField label="Phone"  name="phone"  type="tel"   required />
            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.16em] text-foreground/55 mb-1.5 block">Plan tenure *</span>
              <select required name="tenure" className="w-full liquid-glass rounded-xl px-3.5 py-2.5 text-sm bg-transparent text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60">
                <option value="" className="bg-background">Select…</option>
                <option value="6"  className="bg-background">6 months — 6.5% p.a.</option>
                <option value="12" className="bg-background">12 months — 8.5% p.a.</option>
                <option value="24" className="bg-background">24 months — 10.0% p.a.</option>
              </select>
            </label>
            <FormField label="Investment amount (USD)" name="amount" type="number" required />
            <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-primary text-white px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:opacity-90">
              Submit Application <ArrowUpRight className="size-4" />
            </button>
          </form>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-[800px] px-[var(--gutter)] py-12 sm:py-16">
        <h2 className="text-center font-display uppercase text-2xl sm:text-3xl tracking-tight mb-8">FAQ</h2>
        <div className="space-y-3">
          <FaqItem q="Is my capital really protected?">
            Yes. Your principal is held in a segregated trust account and contractually returned at maturity
            by the regulated underwriter, subject to the policy's full terms.
          </FaqItem>
          <FaqItem q="Are the returns guaranteed?">
            The stated annual return is the contractual yield for the policy. It is not floating or
            performance-linked. It is, however, subject to the underwriter's solvency — see the risk disclosure.
          </FaqItem>
          <FaqItem q="Can I withdraw early?">
            12-month and 24-month plans allow early withdrawal after an initial lock-up. An early-withdrawal
            fee applies and forfeits the yield earned to date.
          </FaqItem>
          <FaqItem q="How are returns paid?">
            For 12- and 24-month plans, returns are paid quarterly into your SwisDex wallet, with the
            principal returned at maturity. The 6-month plan pays principal + yield at maturity.
          </FaqItem>
          <FaqItem q="Do I need to be a SwisDex trading client to apply?">
            No. The plans are open to non-trading investors. KYC and AML verification is still required.
          </FaqItem>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pb-20">
        <div className="liquid-glass-strong rounded-3xl p-8 sm:p-12 text-center">
          <h2 className="font-display uppercase text-2xl sm:text-3xl tracking-tight">Build the stable core of your portfolio</h2>
          <p className="mt-4 text-foreground/70 max-w-xl mx-auto text-sm sm:text-base">
            Capital-protected, fixed-yield, regulated. Apply in minutes, fund in days.
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
