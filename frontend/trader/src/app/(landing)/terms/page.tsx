'use client';

/**
 * Terms of Service — public legal page.
 *
 * Footer + auth/register both link to /terms; previously the route 404'd
 * because the file didn't exist. The copy below is a standard trading-
 * platform terms shell with SwisDex-specific bindings (entity name,
 * jurisdiction, support address). Have legal review the text before
 * shipping to a regulated market.
 */
import Link from 'next/link';
import { FileText, ArrowUpRight, ScrollText, ShieldAlert, Mail, Download, ExternalLink, Shield, Wallet, Scale, FileBadge } from 'lucide-react';
import { BannerPlaceholder } from '@/swisdex/components/BannerPlaceholder';

/**
 * Official legal-document PDFs hosted under /public/pdfs/terms.
 * Filenames include spaces and one typo ("privcy", "complient") — those
 * stay as-is in the URL because the files on disk are named that way,
 * but the visible labels are spelled correctly. Drop a new PDF in the
 * same folder and add a row here to expose it on the page.
 */
const PDF_DOCS: {
  title: string;
  description: string;
  file: string;        // exact filename on disk under /public/pdfs/terms/
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

const SECTIONS = [
  {
    h: '1. Acceptance of Terms',
    p: `By accessing or using the SwisDex platform, website, mobile apps, or any related services
    (collectively, the "Services"), you agree to be bound by these Terms of Service ("Terms"). If
    you do not agree to these Terms, you must not use the Services. Continued use after we publish
    updated Terms constitutes acceptance of those updates.`,
  },
  {
    h: '2. Eligibility',
    p: `You must be at least 18 years of age (or the age of majority in your jurisdiction, whichever
    is greater) and not a resident of any country in which the offering of CFD, forex, or crypto
    trading services is restricted under local law. You are responsible for ensuring your use of
    the Services is lawful in your jurisdiction.`,
  },
  {
    h: '3. Account Registration & KYC',
    p: `To open a live account you must complete our Know-Your-Customer (KYC) verification. You agree
    to provide accurate, current, and complete information and to keep your account details up to
    date. SwisDex may refuse, suspend, or terminate any account at its discretion, including for
    incomplete verification, suspected fraud, or breach of these Terms.`,
  },
  {
    h: '4. Risk Acknowledgement',
    p: `Trading forex, CFDs, crypto-assets, and structured-yield products carries a high degree of
    risk and may not be suitable for every investor. You may lose all or part of your invested
    capital. Past performance is not indicative of future results. You confirm that you have read
    our Risk Disclaimer and that you are trading with capital you can afford to lose.`,
  },
  {
    h: '5. Welcome Bonus, Promotions & Insurance',
    p: `Welcome bonuses, fixed-return plans, and trade-insurance products are governed by their
    respective product-specific terms surfaced on the relevant pages and inside your dashboard at
    the time of opt-in. Bonuses are credited as tradeable equity, are non-withdrawable in
    isolation, and are subject to the unlock conditions disclosed in your account.`,
  },
  {
    h: '6. Decentralised Exchange (DEX) Trades',
    p: `Where you elect to trade through the SwisDex DEX, settlement occurs on-chain via
    smart-contracts. You are responsible for safeguarding your private keys and approving each
    on-chain action. SwisDex does not custody DEX funds and cannot reverse a confirmed on-chain
    transaction.`,
  },
  {
    h: '7. Fees, Spreads & Charges',
    p: `Live spreads, swap charges, commissions, deposit/withdrawal fees, and any product-specific
    charges are displayed inside your trading account and updated from time to time. You agree to
    review the fee schedule before placing trades. Withdrawal-rail fees are pass-through and
    subject to the processor's own schedule.`,
  },
  {
    h: '8. Prohibited Use',
    p: `You agree not to: (a) attempt to manipulate market data, prices, or platform behaviour; (b)
    use the Services for money laundering, sanctions evasion, or any illegal activity; (c) use any
    bot, scraper, or automated system not authorised by SwisDex; or (d) attempt to access another
    user's account. We may suspend or close accounts found in breach without notice.`,
  },
  {
    h: '9. Intellectual Property',
    p: `All SwisDex trademarks, logos, source code, charts, content, and platform UX are the
    property of SwisDex or its licensors. You may not reproduce, modify, or redistribute any part
    of the Services without our prior written consent.`,
  },
  {
    h: '10. Limitation of Liability',
    p: `To the maximum extent permitted by law, SwisDex shall not be liable for any indirect,
    incidental, special, consequential, or punitive damages, or any loss of profits or revenues,
    arising out of or related to the Services. Our aggregate liability shall not exceed the
    aggregate fees paid by you to SwisDex in the twelve months preceding the claim.`,
  },
  {
    h: '11. Governing Law & Disputes',
    p: `These Terms are governed by the laws of Scotland, United Kingdom. Any dispute shall be
    resolved exclusively by the courts of Edinburgh, Scotland, except where mandatory consumer
    rights of your jurisdiction provide otherwise.`,
  },
  {
    h: '12. Changes to These Terms',
    p: `We may amend these Terms from time to time. Material changes will be notified by email
    and/or via an in-app banner. Continued use of the Services after the effective date of any
    amendment constitutes your acceptance of the revised Terms.`,
  },
  {
    h: '13. Contact',
    p: `Questions about these Terms? Email info@swisdex.com or write to SwisDex, Office 23US, 18
    Young St, UNIT LGE 1/1, Edinburgh EH2 4JB, Scotland, United Kingdom.`,
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background">
      <BannerPlaceholder
        title="Terms of Service"
        tagline="The rules that govern your use of SwisDex. Read carefully before you trade."
      />

      <section className="mx-auto max-w-[840px] px-[var(--gutter)] pt-10 pb-6">
        <div className="liquid-glass rounded-2xl px-5 py-4 flex items-center gap-3 text-sm text-foreground/70">
          <FileText className="size-4 text-primary shrink-0" />
          <span>
            <span className="font-semibold text-foreground/90">Effective date:</span> January 1, 2026 ·
            Last updated: June 2026
          </span>
        </div>
      </section>

      {/* Downloadable official PDFs — the signed legal docs sit in
          /public/pdfs/terms. Each card opens the PDF in a new tab and
          offers a direct download via the secondary button. */}
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

      <article className="mx-auto max-w-[840px] px-[var(--gutter)] py-8 sm:py-10 space-y-7">
        {SECTIONS.map(({ h, p }) => (
          <section key={h} className="liquid-glass rounded-2xl p-6 sm:p-7">
            <h2 className="font-display text-lg sm:text-xl uppercase tracking-tight text-foreground mb-3">
              {h}
            </h2>
            <p className="text-sm sm:text-[15px] leading-relaxed text-foreground/75">{p}</p>
          </section>
        ))}

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
              . Reading all three is essential before you open an account.
            </p>
          </div>
          <a
            href="mailto:info@swisdex.com"
            className="inline-flex items-center gap-2 rounded-full bg-primary text-white px-5 py-2.5 text-sm font-semibold uppercase tracking-wider hover:opacity-90 shrink-0"
          >
            <Mail className="size-4" /> Contact Legal
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
