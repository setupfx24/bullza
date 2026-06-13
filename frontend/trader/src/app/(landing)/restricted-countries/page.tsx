'use client';

/**
 * Restricted Countries — public legal page.
 *
 * The list of restricted jurisdictions is the same one already shown in
 * the canonical landing footer (Footer.jsx 'Restricted Regions' callout),
 * surfaced as a dedicated page so the footer 'Restricted Countries' link
 * lands on its own document instead of a PDF download.
 */
import Link from 'next/link';
import { Ban, ArrowUpRight, Globe, Mail, ShieldAlert } from 'lucide-react';
import { BannerPlaceholder } from '@/swisdex/components/BannerPlaceholder';

const RESTRICTED = [
  'United States of America (USA)',
  'Cuba',
  'Iraq',
  'Myanmar',
  'North Korea',
  'Sudan',
];

const SECTIONS = [
  {
    h: '1. Overview',
    body: 'SwisDex Ltd ("Swisdex", "Company", "we", "our", or "us") operates a regulated multi-asset trading platform. Due to local laws, sanctions regimes, regulatory requirements, and risk-management policies, our services are not available to citizens or residents of certain jurisdictions.',
  },
  {
    h: '2. Restricted Jurisdictions',
    body: 'Swisdex does not provide services to citizens, residents, or persons located in the following jurisdictions:',
    list: RESTRICTED,
    trailing: 'The services of Swisdex are not intended for distribution to, or use by, any person in any country or jurisdiction where such distribution or use would be contrary to local law or regulation.',
  },
  {
    h: '3. Client Responsibility',
    body: 'It is your responsibility to ensure that opening a trading account with Swisdex and using our services is lawful in the jurisdiction in which you are a citizen, resident, or physically located. By opening an account you confirm that you are not a citizen, resident, or person physically located in any restricted jurisdiction.',
  },
  {
    h: '4. Misrepresentation',
    body: 'Any attempt to register an account from a restricted jurisdiction — including the use of a VPN, a false address, false identity documents, or any other method to misrepresent residency — constitutes a breach of these Terms and may result in:',
    list: [
      'Immediate account suspension or closure',
      'Withholding of pending deposits, withdrawals, or balances pending compliance review',
      'Reporting of activity to relevant authorities where required',
      'Forfeiture of any bonuses, promotional credits, or referral commissions',
    ],
  },
  {
    h: '5. Updates to the Restricted List',
    body: 'Swisdex reserves the right to add, remove, or modify the list of restricted jurisdictions at any time without prior notice. Updates will become effective immediately upon publication on the Swisdex website. Continued use of Swisdex services following any update constitutes acceptance of the revised list.',
  },
  {
    h: '6. Sanctions & Compliance',
    body: 'In addition to the country list above, Swisdex maintains AML and sanctions-screening procedures that may restrict, suspend, or terminate services for individuals or entities listed on any applicable sanctions list (including, without limitation, OFAC, UN, EU, and UK lists), regardless of country of residence.',
  },
  {
    h: '7. Contact',
    body: 'Questions about jurisdiction eligibility or sanctions compliance can be sent to compliance@swisdex.com. We aim to respond within five business days.',
  },
];

export default function RestrictedCountriesPage() {
  return (
    <main className="min-h-screen" style={{ background: '#08090b', color: '#f5f5f5' }}>
      <BannerPlaceholder
        title="Restricted Countries"
        tagline="Jurisdictions where SwisDex services are not offered."
      />

      <section className="mx-auto max-w-[840px] px-[var(--gutter)] pt-10 pb-6">
        <div className="liquid-glass rounded-2xl px-5 py-4 flex items-center gap-3 text-sm text-foreground/70">
          <Globe className="size-4 text-primary shrink-0" />
          <span>
            <span className="font-semibold text-foreground/90">Swisdex — Restricted Countries</span>{' '}
            · Last updated: June 2026
          </span>
        </div>
      </section>

      {/* Headline callout — quick-glance list of restricted countries */}
      <section className="mx-auto max-w-[840px] px-[var(--gutter)] pt-2 pb-2">
        <div
          className="rounded-2xl p-5 sm:p-6 flex items-start gap-4"
          style={{
            background: 'hsl(0 100% 41% / 0.10)',
            border: '1px solid hsl(0 100% 41% / 0.35)',
          }}
        >
          <Ban className="size-5 text-secondary shrink-0 mt-0.5" />
          <div className="text-sm sm:text-[15px] text-foreground/85 leading-relaxed">
            <span className="font-semibold text-foreground">Services not available in:</span>{' '}
            {RESTRICTED.join(' · ')}.
          </div>
        </div>
      </section>

      <article className="mx-auto max-w-[840px] px-[var(--gutter)] py-6 sm:py-8 space-y-7">
        {SECTIONS.map(({ h, body, list, trailing }) => (
          <section key={h} className="liquid-glass rounded-2xl p-6 sm:p-7">
            <h2 className="font-display text-lg sm:text-xl uppercase tracking-tight text-foreground mb-4">
              {h}
            </h2>
            <div className="text-sm sm:text-[15px] leading-relaxed text-foreground/75 space-y-3">
              <p>{body}</p>
              {list && (
                <ul className="list-disc list-inside space-y-1.5 mt-1 ml-1">
                  {list.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
              {trailing && <p>{trailing}</p>}
            </div>
          </section>
        ))}

        <div className="liquid-glass-strong rounded-2xl p-6 sm:p-7 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldAlert className="size-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-foreground/75 leading-relaxed">
              Read this alongside our{' '}
              <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/risk" className="text-primary underline-offset-4 hover:underline">
                Risk Disclaimer
              </Link>
              .
            </p>
          </div>
          <a
            href="mailto:compliance@swisdex.com"
            className="inline-flex items-center gap-2 rounded-full bg-primary text-white px-5 py-2.5 text-sm font-semibold uppercase tracking-wider hover:opacity-90 shrink-0"
          >
            <Mail className="size-4" /> Contact Compliance
          </a>
        </div>
      </article>

      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pb-20">
        <div className="liquid-glass-strong rounded-3xl p-8 sm:p-12 text-center">
          <h2 className="font-display uppercase text-2xl sm:text-3xl tracking-tight">
            Eligible to Trade?
          </h2>
          <p className="mt-4 text-foreground/70 max-w-xl mx-auto text-sm sm:text-base">
            If your jurisdiction isn&apos;t on the restricted list, open a SwisDex account in minutes.
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
