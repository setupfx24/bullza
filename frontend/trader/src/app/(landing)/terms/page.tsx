'use client';

/**
 * Terms & Conditions — public legal page.
 *
 * Section copy is preserved verbatim from the client-supplied PDF
 * "terms and condition.pdf" (delivered 2026-06-09). The 14-section
 * structure + numbered clauses match the PDF; only the visual chrome
 * follows the dark-themed (landing) layout. Six signed PDFs are
 * surfaced as a download grid above the inline sections.
 */
import Link from 'next/link';
import {
  FileText, ArrowUpRight, ScrollText, ShieldAlert, Mail,
  Download, ExternalLink, Shield, Wallet, Scale, FileBadge,
} from 'lucide-react';
import { BannerPlaceholder } from '@/swisdex/components/BannerPlaceholder';

/**
 * Official legal-document PDFs hosted under /public/pdfs/terms.
 * Filenames include spaces and one typo ("privcy", "complient") — those
 * stay as-is in the URL because the files on disk are named that way,
 * but the visible labels are spelled correctly.
 */
const PDF_DOCS: {
  title: string;
  description: string;
  file: string;
  sizeKB: number;
  icon: typeof FileText;
}[] = [
  {
    title: 'Terms & Conditions',
    description: 'The core agreement between you and SwisDex — eligibility, account rules, and conduct.',
    file: 'terms and condition.pdf',
    sizeKB: 24,
    icon: ScrollText,
  },
  {
    title: 'Privacy Policy',
    description: 'What personal data we collect, how it is processed, your rights under GDPR / UK-DPA.',
    file: 'privcy policy.pdf',
    sizeKB: 29,
    icon: Shield,
  },
  {
    title: 'Promotional & Service Terms',
    description: 'Specific rules for welcome bonuses, fixed-return plans, trade insurance, and IB rewards.',
    file: 'SwisDex Promotional & Service Terms and Conditions.pdf',
    sizeKB: 24,
    icon: FileBadge,
  },
  {
    title: 'Deposit & Withdrawal Policy',
    description: 'Accepted rails, processing windows, fees, and the verification steps for fund movement.',
    file: 'deposit and withdrawal.pdf',
    sizeKB: 26,
    icon: Wallet,
  },
  {
    title: 'Client Fund Security',
    description: 'Segregated banking, cold storage of crypto, insurance cover, and our negative-balance protection.',
    file: 'Client Fund Security.pdf',
    sizeKB: 24,
    icon: ShieldAlert,
  },
  {
    title: 'Compliance & Dispute Resolution',
    description: 'Our AML / KYC framework, complaint-handling timelines, and the dispute escalation path.',
    file: 'complient and dispute.pdf',
    sizeKB: 22,
    icon: Scale,
  },
];

const pdfHref = (file: string) => `/pdfs/terms/${encodeURI(file)}`;

/**
 * 14 numbered sections preserving the client-PDF wording verbatim.
 * Each clause is rendered as `[number] body…` so the on-screen layout
 * mirrors a typical legal contract.
 */
const SECTIONS: { h: string; clauses: { n: string; body: string }[] }[] = [
  {
    h: '1. Acceptance of Terms',
    clauses: [
      { n: '1.1', body: 'By accessing or using any services, products, platforms, or tools offered by Swisdex (hereinafter referred to as "Swisdex"), you agree to be bound by these Terms & Conditions. If you do not agree with any part of these terms, you should not access or use any Swisdex services.' },
      { n: '1.2', body: 'These Terms & Conditions apply to all users, clients, visitors, and customers of Swisdex, whether registered or unregistered. By accessing or using the platform, you acknowledge and accept these Terms & Conditions.' },
    ],
  },
  {
    h: '2. Binding Agreement',
    clauses: [
      { n: '2.1', body: 'By registering for an account or using Swisdex services, you enter into a legally binding agreement with Swisdex.' },
      { n: '2.2', body: 'You acknowledge that your continued use of Swisdex services constitutes acceptance of these Terms & Conditions and any additional policies, agreements, disclosures, or legal documentation published by Swisdex.' },
    ],
  },
  {
    h: '3. Eligibility and Age Requirement',
    clauses: [
      { n: '3.1', body: 'To use Swisdex services, you must be at least eighteen (18) years old or the legal age required to enter into a binding agreement in your jurisdiction.' },
      { n: '3.2', body: 'By opening an account, you confirm that all information provided is accurate and that you meet the eligibility requirements.' },
      { n: '3.3', body: 'Providing false information regarding your identity, age, or residency is strictly prohibited and may result in immediate account suspension or termination.' },
    ],
  },
  {
    h: '4. Trading Risk Disclosure',
    clauses: [
      { n: '4.1', body: 'Forex, commodities, cryptocurrencies, indices, and CFD trading involve substantial risk and may not be suitable for all investors.' },
      { n: '4.2', body: 'You acknowledge that you may lose part or all of your deposited funds and that past performance does not guarantee future results.' },
      { n: '4.3', body: 'Swisdex does not guarantee profits, returns, or successful trading outcomes unless explicitly stated under a specific promotional program governed by separate terms.' },
      { n: '4.4', body: 'Clients are solely responsible for their trading decisions and investment activities.' },
    ],
  },
  {
    h: '5. Account Registration and Security',
    clauses: [
      { n: '5.1', body: 'Clients must provide accurate, complete, and up-to-date information during registration.' },
      { n: '5.2', body: 'You are responsible for maintaining the confidentiality of your account credentials, passwords, and security information.' },
      { n: '5.3', body: 'Swisdex shall not be liable for losses arising from unauthorized access resulting from your failure to protect account credentials.' },
    ],
  },
  {
    h: '6. Deposits and Withdrawals',
    clauses: [
      { n: '6.1', body: 'Clients may fund their accounts using payment methods approved by Swisdex.' },
      { n: '6.2', body: 'Withdrawal requests are subject to verification, compliance checks, and anti-money laundering (AML) procedures.' },
      { n: '6.3', body: 'Swisdex reserves the right to request additional identification documents before processing withdrawals.' },
      { n: '6.4', body: 'Processing times may vary depending on the selected payment method and verification requirements.' },
    ],
  },
  {
    h: '7. Bonuses, Promotions, and Trade Insurance',
    clauses: [
      { n: '7.1', body: 'Any bonuses, deposit promotions, referral rewards, trade insurance programs, or special offers are subject to separate promotional terms.' },
      { n: '7.2', body: 'Swisdex reserves the right to modify, suspend, or cancel promotional programs at any time without prior notice.' },
      { n: '7.3', body: 'Abuse, manipulation, arbitrage, or fraudulent use of promotional programs may result in cancellation of rewards and account restrictions.' },
    ],
  },
  {
    h: '8. Referral and Introducing Broker (IB) Program',
    clauses: [
      { n: '8.1', body: 'Participants in the Referral Program and IB Program must comply with all applicable laws and ethical marketing standards.' },
      { n: '8.2', body: 'Swisdex reserves the right to adjust, withhold, or revoke commissions generated through fraudulent, misleading, or prohibited activities.' },
      { n: '8.3', body: 'Referral and IB commissions are subject to qualification requirements outlined in the relevant program documentation.' },
    ],
  },
  {
    h: '9. Anti-Money Laundering (AML) and Compliance',
    clauses: [
      { n: '9.1', body: 'Swisdex maintains strict AML and Know Your Customer (KYC) procedures.' },
      { n: '9.2', body: 'Clients may be required to provide identification documents, proof of address, and other verification materials.' },
      { n: '9.3', body: 'Swisdex reserves the right to suspend or terminate accounts involved in suspicious, illegal, or non-compliant activities.' },
    ],
  },
  {
    h: '10. Limitation of Liability',
    clauses: [
      { n: '10.1', body: 'Swisdex shall not be liable for any indirect, incidental, consequential, or special damages arising from the use of its services.' },
      { n: '10.2', body: 'Swisdex is not responsible for losses resulting from market volatility, technical failures, internet disruptions, third-party service interruptions, or force majeure events.' },
    ],
  },
  {
    h: '11. Suspension and Termination',
    clauses: [
      { n: '11.1', body: 'Swisdex reserves the right to suspend, restrict, or terminate any account that violates these Terms & Conditions or applicable regulations.' },
      { n: '11.2', body: 'Upon termination, clients must immediately cease using Swisdex services.' },
    ],
  },
  {
    h: '12. Amendments',
    clauses: [
      { n: '12.1', body: 'Swisdex reserves the right to modify, update, or replace these Terms & Conditions at any time.' },
      { n: '12.2', body: 'Continued use of Swisdex services after updates become effective constitutes acceptance of the revised Terms & Conditions.' },
    ],
  },
  {
    h: '13. Governing Law',
    clauses: [
      { n: '13.1', body: 'These Terms & Conditions shall be governed by and interpreted in accordance with the laws applicable to the jurisdiction under which Swisdex operates.' },
      { n: '13.2', body: 'Any disputes arising from these Terms & Conditions shall be subject to the exclusive jurisdiction of the relevant courts or arbitration authorities.' },
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen" style={{ background: '#08090b', color: '#f5f5f5' }}>
      <BannerPlaceholder
        title="Terms and Conditions"
        tagline="The rules that govern your use of SwisDex. Read carefully before you trade."
      />

      <section className="mx-auto max-w-[840px] px-[var(--gutter)] pt-10 pb-6">
        <div className="liquid-glass rounded-2xl px-5 py-4 flex items-center gap-3 text-sm text-foreground/70">
          <FileText className="size-4 text-primary shrink-0" />
          <span>
            <span className="font-semibold text-foreground/90">Swisdex — Terms and Conditions</span>{' '}
            · Last updated: June 2026
          </span>
        </div>
      </section>

      {/* Downloadable official PDFs */}
      <section
        id="documents"
        className="mx-auto max-w-[1100px] px-[var(--gutter)] pt-2 pb-8 sm:pb-12"
      >
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full liquid-glass text-[11px] uppercase tracking-[0.18em] text-foreground/70">
            <FileText className="size-3.5 text-primary" /> Official Documents
          </span>
          <h2 className="mt-4 font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">
            Download the Full Legal Pack
          </h2>
          <p className="mt-3 text-foreground/65 max-w-2xl mx-auto text-sm sm:text-base">
            The signed PDF version of every SwisDex policy — open in your browser to read
            or download a copy for your records.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
          {PDF_DOCS.map(({ title, description, file, sizeKB, icon: Icon }) => (
            <article
              key={file}
              className="liquid-glass rounded-2xl p-5 sm:p-6 flex flex-col gap-4 hover:bg-foreground/[0.03] transition-colors"
            >
              <div className="flex items-start gap-4">
                <div
                  className="size-12 shrink-0 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'hsl(99 55% 42% / 0.18)',
                    border: '1px solid hsl(99 55% 42% / 0.45)',
                  }}
                >
                  <Icon className="size-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-base sm:text-lg uppercase tracking-tight text-foreground">
                    {title}
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm text-foreground/65 leading-relaxed">
                    {description}
                  </p>
                </div>
              </div>

              <div className="mt-auto flex items-center justify-between gap-3 pt-2 border-t border-foreground/10">
                <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-foreground/55">
                  <FileText className="size-3.5" />
                  PDF · {sizeKB} KB
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={pdfHref(file)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full liquid-glass px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-foreground hover:bg-foreground/5"
                    aria-label={`View ${title} in a new tab`}
                  >
                    View <ExternalLink className="size-3" />
                  </a>
                  <a
                    href={pdfHref(file)}
                    download={file}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary text-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider hover:opacity-90"
                    aria-label={`Download ${title}`}
                  >
                    Download <Download className="size-3" />
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-6 text-center text-[11px] text-foreground/45 max-w-2xl mx-auto leading-relaxed">
          Documents are provided in PDF format. If a download fails, right-click the
          View button and choose &quot;Save link as&quot; to save the file locally.
        </p>
      </section>

      {/* 14 verbatim PDF sections */}
      <article className="mx-auto max-w-[840px] px-[var(--gutter)] py-8 sm:py-10 space-y-7">
        {SECTIONS.map(({ h, clauses }) => (
          <section key={h} className="liquid-glass rounded-2xl p-6 sm:p-7">
            <h2 className="font-display text-lg sm:text-xl uppercase tracking-tight text-foreground mb-4">
              {h}
            </h2>
            <div className="space-y-3 text-sm sm:text-[15px] leading-relaxed text-foreground/75">
              {clauses.map(({ n, body }) => (
                <p key={n}>
                  <b className="text-foreground/95 mr-1">{n}</b> {body}
                </p>
              ))}
            </div>
          </section>
        ))}

        {/* Section 14 — Contact (special handling: includes contact card) */}
        <section className="liquid-glass rounded-2xl p-6 sm:p-7">
          <h2 className="font-display text-lg sm:text-xl uppercase tracking-tight text-foreground mb-4">
            14. Contact Information
          </h2>
          <p className="text-sm sm:text-[15px] leading-relaxed text-foreground/75 mb-4">
            For any questions, support requests, or concerns regarding these Terms &amp; Conditions, please contact:
          </p>
          <div
            className="rounded-xl p-5 text-sm space-y-1"
            style={{
              background: 'hsl(99 55% 42% / 0.10)',
              border: '1px solid hsl(99 55% 42% / 0.35)',
            }}
          >
            <p className="font-semibold text-foreground">Swisdex Support Team</p>
            <p className="text-foreground/75">
              Email:{' '}
              <a href="mailto:support@swisdex.com" className="text-primary hover:underline">
                support@swisdex.com
              </a>
            </p>
          </div>
          <p className="mt-4 text-sm sm:text-[15px] leading-relaxed text-foreground/75">
            By registering for an account and using Swisdex services, you confirm that you have read, understood, and agreed to these Terms &amp; Conditions.
          </p>
        </section>

        {/* Risk Disclaimer — kept as the platform's standard trader-facing warning */}
        <div
          className="rounded-2xl p-6 sm:p-7"
          style={{
            background: 'hsl(0 100% 41% / 0.08)',
            border: '1px solid hsl(0 100% 41% / 0.35)',
          }}
        >
          <h2 className="font-display text-lg sm:text-xl uppercase tracking-tight text-foreground mb-3 inline-flex items-center gap-2">
            <ShieldAlert className="size-5 text-secondary" /> Risk Disclaimer
          </h2>
          <p className="text-sm sm:text-[15px] leading-relaxed text-foreground/75">
            Trading foreign exchange (forex) and other leveraged financial products carries a high level of risk and may not be suitable for all investors. Leverage can work both for and against you — while it amplifies potential profits, it equally amplifies potential losses. You could sustain a loss of some or all of your initial investment and should not invest money that you cannot afford to lose. You should be aware of all the risks associated with leveraged trading and seek independent financial advice if you have any doubts. Past performance is not indicative of future results.
          </p>
        </div>

        {/* Cross-links */}
        <div className="liquid-glass-strong rounded-2xl p-6 sm:p-7 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldAlert className="size-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-foreground/75 leading-relaxed">
              These Terms work alongside our{' '}
              <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
                Privacy Policy
              </Link>{' '}
              and{' '}
              <Link href="/risk" className="text-primary underline-offset-4 hover:underline">
                Risk Disclaimer
              </Link>
              .
            </p>
          </div>
          <a
            href="mailto:support@swisdex.com"
            className="inline-flex items-center gap-2 rounded-full bg-primary text-white px-5 py-2.5 text-sm font-semibold uppercase tracking-wider hover:opacity-90 shrink-0"
          >
            <Mail className="size-4" /> Contact Support
          </a>
        </div>
      </article>

      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pb-20">
        <div className="liquid-glass-strong rounded-3xl p-8 sm:p-12 text-center">
          <h2 className="font-display uppercase text-2xl sm:text-3xl tracking-tight inline-flex items-center gap-2">
            <ScrollText className="size-6 text-primary" /> Ready to Begin?
          </h2>
          <p className="mt-4 text-foreground/70 max-w-xl mx-auto text-sm sm:text-base">
            By opening a SwisDex account, you confirm you have read and accepted these Terms.
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
