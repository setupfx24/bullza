'use client';

/**
 * Privacy Policy — public legal page.
 *
 * Section copy is preserved verbatim from the client-supplied PDF
 * "privcy policy.pdf" (delivered 2026-06-09). The 15-section structure
 * is preserved; only the visual chrome follows the dark-themed (landing)
 * layout.
 */
import Link from 'next/link';
import { Lock, ArrowUpRight, ShieldCheck, Mail } from 'lucide-react';
import { BannerPlaceholder } from '@/swisdex/components/BannerPlaceholder';

/**
 * Each section has a heading + body. `body` can mix prose paragraphs,
 * sub-sections (sub-heading + bullets), and plain bullet lists. This
 * is the minimum structure needed to reproduce the PDF wording 1:1.
 */
type Subsection = { title: string; lead?: string; bullets?: string[]; trailing?: string };
type Section = {
  h: string;
  lead?: string[];          // top-level prose paragraphs
  bullets?: string[];        // top-level bullets
  subs?: Subsection[];       // sub-sections like "Identity Information"
  trailing?: string[];       // closing paragraphs after bullets / subs
};

const INTRO: Section = {
  h: 'Privacy Policy of Swisdex',
  lead: [
    'At Swisdex ("Swisdex", "Company", "we", "our", or "us"), protecting your privacy and personal information is one of our highest priorities. We are committed to collecting, processing, storing, and protecting your personal data responsibly and in accordance with applicable data protection laws and industry best practices.',
    'By accessing our website, opening an account, or using any Swisdex products and services, you consent to the collection and processing of your personal information as described in this Privacy Policy.',
  ],
};

const SECTIONS: Section[] = [
  {
    h: '1. Privacy Protection',
    lead: [
      'Swisdex maintains appropriate administrative, technical, and organizational measures designed to protect personal information from unauthorized access, misuse, loss, alteration, or disclosure.',
      'Client information is stored securely and accessed only by authorized personnel who require such information for legitimate business, compliance, or support purposes.',
      'While we implement reasonable security safeguards, no method of transmission over the internet or electronic storage system can be guaranteed to be completely secure.',
      'Clients are responsible for maintaining the confidentiality of their account credentials, passwords, and authentication devices.',
    ],
  },
  {
    h: '2. Personal Information We Collect',
    lead: ['When opening an account or using Swisdex services, we may collect the following information:'],
    subs: [
      { title: 'Identity Information', bullets: ['Full Name', 'Date of Birth', 'Nationality', 'Government Identification Details', 'Passport or National ID Copies', 'Selfie Verification Images'] },
      { title: 'Contact Information', bullets: ['Email Address', 'Telephone Number', 'Residential Address'] },
      { title: 'Financial Information', bullets: ['Source of Funds Information', 'Cryptocurrency Wallet Information', 'Deposit and Withdrawal Records', 'Transaction History'] },
      { title: 'Technical Information', bullets: ['IP Address', 'Browser Information', 'Device Information', 'Operating System Information', 'Website Usage Data'] },
      { title: 'Trading Information', bullets: ['Trading Activity', 'Trading Preferences', 'Account Performance', 'Trading History'] },
    ],
  },
  {
    h: '3. How We Use Your Personal Information',
    lead: ['Swisdex may process your personal information for the following purposes:'],
    subs: [
      { title: 'Account Registration and Management', lead: 'To:', bullets: ['Open and maintain trading accounts', 'Verify identity', 'Provide customer support', 'Manage account security'] },
      { title: 'Compliance and Regulatory Requirements', lead: 'To:', bullets: ['Perform KYC verification', 'Conduct AML screening', 'Prevent fraud and financial crime', 'Comply with legal obligations'] },
      { title: 'Service Delivery', lead: 'To:', bullets: ['Process deposits and withdrawals', 'Facilitate trading activities', 'Operate client accounts', 'Provide platform functionality'] },
      { title: 'Risk Management', lead: 'To:', bullets: ['Monitor suspicious activity', 'Protect account security', 'Prevent abuse of promotions and bonuses', 'Detect unauthorized transactions'] },
      { title: 'Communication', lead: 'To:', bullets: ['Respond to inquiries', 'Send service-related notifications', 'Deliver security alerts', 'Provide account updates'] },
      { title: 'Marketing Communications', lead: 'Subject to applicable laws and your preferences, Swisdex may send information regarding:', bullets: ['New products', 'Platform updates', 'Promotions', 'Educational content', 'Market insights'], trailing: 'Clients may opt out of marketing communications at any time.' },
    ],
  },
  {
    h: '4. Legal Basis for Processing',
    lead: ['We process personal information based on one or more of the following legal grounds:'],
    subs: [
      { title: 'Contract Performance', lead: 'Processing necessary to provide services requested by the client.' },
      { title: 'Legal and Regulatory Obligations', lead: 'Processing required to comply with applicable laws, AML regulations, sanctions requirements, and compliance obligations.' },
      { title: 'Legitimate Business Interests', lead: 'Processing necessary for:', bullets: ['Risk management', 'Fraud prevention', 'Service improvement', 'Security monitoring', 'Internal administration'] },
      { title: 'Client Consent', lead: 'Where required by law, processing may be based on the client\'s consent, which may be withdrawn at any time.' },
    ],
  },
  {
    h: '5. KYC and AML Compliance',
    lead: [
      'Swisdex is committed to maintaining robust Know Your Customer (KYC) and Anti-Money Laundering (AML) procedures.',
      'Clients may be required to provide:',
    ],
    bullets: ['Government-issued identification', 'Proof of address', 'Selfie verification', 'Source of funds documentation', 'Additional compliance information'],
    trailing: ['Failure to complete verification requirements may result in account restrictions, deposit delays, or withdrawal limitations.'],
  },
  {
    h: '6. Disclosure of Personal Information',
    lead: [
      'Swisdex does not sell client personal information.',
      'Personal information may be shared only when necessary with:',
    ],
    subs: [
      { title: 'Service Providers', lead: 'Including:', bullets: ['Technology providers', 'Hosting providers', 'Payment and crypto infrastructure providers', 'Security service providers'] },
      { title: 'Compliance and Regulatory Authorities', lead: 'Where disclosure is required by law, regulation, court order, or government request.' },
      { title: 'Professional Advisors', lead: 'Including:', bullets: ['Legal advisors', 'Auditors', 'Compliance consultants', 'Risk management providers'] },
      { title: 'Business Partners', lead: 'Only where necessary for providing services or fulfilling contractual obligations.' },
    ],
    trailing: ['All third parties receiving personal information are expected to maintain appropriate confidentiality and security standards.'],
  },
  {
    h: '7. Cryptocurrency Transactions',
    lead: ['As Swisdex operates a crypto-funded trading environment:'],
    bullets: [
      'Deposit and withdrawal transactions may be recorded on public blockchain networks.',
      'Blockchain transactions are transparent and may be publicly visible.',
      'Swisdex cannot control information recorded on public blockchains.',
    ],
    trailing: ['Clients are responsible for protecting the privacy of their own cryptocurrency wallets and addresses.'],
  },
  {
    h: '8. Cookies and Website Analytics',
    lead: ['Swisdex may use:'],
    bullets: ['Cookies', 'Analytics tools', 'Pixel tags', 'Session tracking technologies'],
    trailing: [
      'These technologies help us:',
      'Improve website performance · Enhance user experience · Analyze traffic patterns · Detect fraud and security risks',
      'Clients may adjust browser settings to limit cookie usage, although some website functions may be affected.',
    ],
  },
  {
    h: '9. International Data Transfers',
    lead: [
      'Personal information may be processed or stored in countries outside the client\'s country of residence.',
      'Where international transfers occur, Swisdex will take reasonable measures to ensure that personal information receives an appropriate level of protection consistent with applicable privacy requirements.',
    ],
  },
  {
    h: '10. Data Retention',
    lead: ['Swisdex retains personal information only for as long as necessary to:'],
    bullets: ['Provide services', 'Comply with legal obligations', 'Resolve disputes', 'Prevent fraud', 'Meet regulatory requirements'],
    trailing: ['Client records, communications, transaction histories, and verification documents may be retained for a minimum period required by applicable AML and compliance regulations.'],
  },
  {
    h: '11. Your Rights',
    lead: ['Depending on applicable laws, clients may have the right to:'],
    subs: [
      { title: 'Access', lead: 'Request a copy of personal information held by Swisdex.' },
      { title: 'Correction', lead: 'Request correction of inaccurate or incomplete information.' },
      { title: 'Deletion', lead: 'Request deletion of personal information where legally permitted.' },
      { title: 'Restriction', lead: 'Request limitations on certain processing activities.' },
      { title: 'Objection', lead: 'Object to specific processing activities.' },
      { title: 'Data Portability', lead: 'Request transfer of personal information in a structured format where applicable.' },
    ],
    trailing: ['Requests may be submitted through our support team.'],
  },
  {
    h: '12. Security Measures',
    lead: ['Swisdex implements security controls designed to protect personal information, including:'],
    bullets: ['Secure data storage', 'Access control procedures', 'Encryption technologies where appropriate', 'Internal compliance monitoring', 'Security audits and reviews'],
    trailing: ['Despite these measures, clients should understand that no electronic system is completely immune from security risks.'],
  },
  {
    h: '13. Legal Disclosure',
    lead: ['Swisdex may disclose personal information when required to:'],
    bullets: ['Comply with legal obligations', 'Respond to lawful requests', 'Protect company rights', 'Prevent fraud', 'Investigate suspicious activity', 'Enforce contractual agreements'],
    trailing: ['Such disclosures will only occur when legally justified.'],
  },
  {
    h: '14. Changes to This Privacy Policy',
    lead: [
      'Swisdex reserves the right to modify this Privacy Policy at any time.',
      'Updated versions will become effective upon publication on the Swisdex website.',
      'Continued use of Swisdex services following any update constitutes acceptance of the revised Privacy Policy.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      <BannerPlaceholder
        title="Privacy Policy"
        tagline="What personal data we collect, why we collect it, and how we keep it safe."
      />

      <section className="mx-auto max-w-[840px] px-[var(--gutter)] pt-10 pb-6">
        <div className="liquid-glass rounded-2xl px-5 py-4 flex items-center gap-3 text-sm text-foreground/70">
          <Lock className="size-4 text-primary shrink-0" />
          <span>
            <span className="font-semibold text-foreground/90">Swisdex — Privacy Policy</span>{' '}
            · Last updated: June 2026
          </span>
        </div>
      </section>

      <article className="mx-auto max-w-[840px] px-[var(--gutter)] py-6 sm:py-8 space-y-7">
        {/* Intro card */}
        <section className="liquid-glass rounded-2xl p-6 sm:p-7">
          <h2 className="font-display text-lg sm:text-xl uppercase tracking-tight text-foreground mb-4">
            {INTRO.h}
          </h2>
          <div className="space-y-3 text-sm sm:text-[15px] leading-relaxed text-foreground/75">
            {INTRO.lead?.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </section>

        {SECTIONS.map((sec) => (
          <section key={sec.h} className="liquid-glass rounded-2xl p-6 sm:p-7">
            <h2 className="font-display text-lg sm:text-xl uppercase tracking-tight text-foreground mb-4">
              {sec.h}
            </h2>
            <div className="text-sm sm:text-[15px] leading-relaxed text-foreground/75 space-y-3">
              {sec.lead?.map((p, i) => <p key={`lead-${i}`}>{p}</p>)}
              {sec.bullets && (
                <ul className="list-disc list-inside space-y-1.5 mt-1">
                  {sec.bullets.map((b) => <li key={b}>{b}</li>)}
                </ul>
              )}
              {sec.subs?.map((sub) => (
                <div key={sub.title} className="mt-3">
                  <h3 className="font-semibold text-foreground/90 mb-1.5">{sub.title}</h3>
                  {sub.lead && <p>{sub.lead}</p>}
                  {sub.bullets && (
                    <ul className="list-disc list-inside space-y-1.5 mt-1.5">
                      {sub.bullets.map((b) => <li key={b}>{b}</li>)}
                    </ul>
                  )}
                  {sub.trailing && <p className="mt-2">{sub.trailing}</p>}
                </div>
              ))}
              {sec.trailing?.map((p, i) => <p key={`tail-${i}`}>{p}</p>)}
            </div>
          </section>
        ))}

        {/* Section 15 — Contact (special handling) */}
        <section className="liquid-glass rounded-2xl p-6 sm:p-7">
          <h2 className="font-display text-lg sm:text-xl uppercase tracking-tight text-foreground mb-4">
            15. Contact Information
          </h2>
          <p className="text-sm sm:text-[15px] leading-relaxed text-foreground/75 mb-4">
            For questions, concerns, requests, or complaints regarding this Privacy Policy, please contact:
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
            Swisdex is committed to protecting client privacy and maintaining the highest standards of data security and confidentiality.
          </p>
        </section>

        {/* Cross-links */}
        <div className="liquid-glass-strong rounded-2xl p-6 sm:p-7 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="size-5 text-primary shrink-0 mt-0.5" />
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
            href="mailto:support@swisdex.com"
            className="inline-flex items-center gap-2 rounded-full bg-primary text-white px-5 py-2.5 text-sm font-semibold uppercase tracking-wider hover:opacity-90 shrink-0"
          >
            <Mail className="size-4" /> Contact Support
          </a>
        </div>
      </article>

      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pb-20">
        <div className="liquid-glass-strong rounded-3xl p-8 sm:p-12 text-center">
          <h2 className="font-display uppercase text-2xl sm:text-3xl tracking-tight">
            Your Data, Your Control
          </h2>
          <p className="mt-4 text-foreground/70 max-w-xl mx-auto text-sm sm:text-base">
            Open a SwisDex account confident that we treat your personal data with the same care we
            apply to your trading capital.
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
