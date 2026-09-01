'use client';

/**
 * Welcome Bonus page. Restyled onto the shared marketing design system;
 * every line of copy is carried over from the previous version.
 */
import Link from 'next/link';
import {
  Gift, Wallet, CheckCircle2, Sparkles, Zap, ShieldCheck, Clock,
} from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, FaqAccordion, CtaBanner } from '@/marketing/components';
import type { FaqItem } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

const SIGNUP_HREF = '/auth/register';

const STEPS = [
  { n: '01', icon: Wallet,       title: 'Open Account',       body: 'Sign up in under 3 minutes. KYC verification is automated and usually completes within 24 hours.' },
  { n: '02', icon: Gift,         title: 'Make First Deposit',  body: 'Deposit at least $50 via crypto, wire, or card. Tier is set automatically based on amount.' },
  { n: '03', icon: Zap,          title: 'Bonus Credited',      body: 'Matching bonus lands in your bonus-equity balance within minutes — no manual claim needed.' },
  { n: '04', icon: CheckCircle2, title: 'Trade & Withdraw',    body: 'Use the bonus equity to open positions. Withdraw your profits at any time — no holding period.' },
];

const FAQS: FaqItem[] = [
  {
    q: 'What is the minimum deposit to claim the welcome bonus?',
    a: 'Only $50. Make a first deposit of $50 or more and the matching welcome bonus is credited to your account automatically — no promo code needed. Larger deposits unlock higher bonus tiers up to the full match.',
  },
  {
    q: 'Can I withdraw the bonus immediately?',
    a: 'Your profits from trading the bonus are withdrawable at any time. The bonus equity itself is subject to the standard programme terms shown in your dashboard.',
  },
  {
    q: 'What happens if I deposit more than once?',
    a: 'The welcome bonus applies only to your first qualifying deposit. Subsequent deposits are eligible for loyalty rewards and reload promotions, which run separately.',
  },
  {
    q: 'Which deposit methods qualify?',
    a: `All standard methods qualify: crypto (BTC, ETH, USDT, USDC), bank wire, Visa/Mastercard, Skrill, Neteller, and supported local options. Internal transfers between ${BRAND_NAME} accounts do not qualify.`,
  },
  {
    q: 'What if I lose the bonus on a trade?',
    a: 'Bonus equity absorbs losses first — your deposited capital is protected ahead of bonus. If the bonus is fully consumed by losses, your principal is untouched.',
  },
  {
    q: 'Can the bonus be combined with other promotions?',
    a: 'Yes. The welcome bonus stacks with the ongoing referral program, loyalty rewards, and trade cashback. It cannot be combined with one-time competitor-switch offers.',
  },
];

export default function BonusPage() {
  return (
    <main>
      <PageHero
        kicker="Limited-Time Welcome Offer"
        title={<><span style={{ color: 'var(--mk-accent)' }}>100% Bonus</span> on Your First Deposit</>}
        lead="On your first deposit — auto-credited within minutes, fully tradeable, no promo code needed."
        primary={{ label: 'Claim Bonus', href: SIGNUP_HREF }}
        secondary={{ label: 'See FAQ', href: '#faq' }}
      />

      {/* Intro callout */}
      <Section raised>
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-8 items-center">
          <div className="flex flex-col gap-4">
            <span className="mk-kicker">
              <Sparkles size={13} /> Limited-Time Welcome Offer
            </span>
            <h2 className="mk-h2">
              Deposit more. <span style={{ color: 'var(--mk-accent)' }}>Trade with more.</span>
            </h2>
            <p className="mk-lead">
              {BRAND_NAME} matches your first deposit with bonus equity that lands in your account within minutes.
              The bigger the tier you hit, the larger the matched amount — up to a full{' '}
              <span className="font-bold" style={{ color: 'var(--mk-accent)' }}>$200</span> credited on a $200 deposit.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href={SIGNUP_HREF} className="mk-btn mk-btn--primary">Claim Bonus</Link>
              <Link href="#faq" className="mk-btn mk-btn--ghost">See FAQ</Link>
            </div>
          </div>
          {/* Bonus illustration — branded artwork dropped by the client. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/bonus_details3.png"
            alt="Welcome bonus illustration"
            className="w-full max-w-full min-h-[260px] max-h-[340px] object-cover"
            style={{ borderRadius: 'var(--mk-radius-lg)', border: '1px solid var(--mk-accent-line)' }}
          />
        </div>
      </Section>

      {/* "Pick Your Tier" section removed per client request — the
          welcome bonus rules are explained inline in the intro callout
          and FAQ; visitors land on /auth/register from the page CTA. */}

      {/* How it works */}
      <Section>
        <SectionHeading
          kicker="Claiming"
          title="How to Claim"
          lead="Four simple steps — no promo codes, no support tickets, no waiting."
        />
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
          {STEPS.map(({ n, icon: Icon, title, body }) => (
            <li key={n} className="mk-card mk-card--hover flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <span
                  className="font-extrabold"
                  style={{ fontSize: 'var(--mk-text-h2)', color: 'var(--mk-accent-line)', lineHeight: 1 }}
                >
                  {n}
                </span>
                <span
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
                  style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
                >
                  <Icon size={20} />
                </span>
              </div>
              <h3 className="mk-h3">{title}</h3>
              <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Why our bonus is different */}
      <Section raised>
        <SectionHeading kicker="The Difference" title="Why This Bonus Is Different" />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: Zap,          title: 'Instant Credit',    body: 'No 5-day approval. Bonus lands in your account within minutes of your deposit clearing.' },
            { icon: CheckCircle2, title: 'Fully Tradeable',   body: 'Use the bonus equity on any instrument — forex, crypto, indices, metals. No restrictions.' },
            { icon: ShieldCheck,  title: 'Transparent Terms', body: 'Plain-English programme terms. Bonus status and equity are visible in your dashboard from day one.' },
            { icon: Clock,        title: 'No Time Pressure',  body: 'No 30-day deadline games. Take the time you need to trade the unlock volume responsibly.' },
            { icon: Sparkles,     title: 'No Promo Codes',    body: 'Tier is set automatically by deposit size. No emails to chase, no codes to remember.' },
          ]}
        />
      </Section>

      {/* FAQ */}
      <Section id="faq">
        <SectionHeading kicker="Questions" title="FAQ" />
        <div className="mx-auto max-w-[800px] mt-12">
          <FaqAccordion items={FAQS} />
        </div>
      </Section>

      <CtaBanner
        title="Claim Your Bonus Today"
        lead={`Open your ${BRAND_NAME} account, make your first deposit, and the matching bonus is in your balance within minutes.`}
        primary={{ label: 'Open Account', href: SIGNUP_HREF }}
        secondary={{ label: 'Read the FAQ', href: '#faq' }}
      />
    </main>
  );
}
