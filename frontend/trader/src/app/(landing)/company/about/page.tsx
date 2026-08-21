import Link from 'next/link';
import {
  Users, Globe, Award, TrendingUp, Wallet, Zap, Handshake, Moon,
} from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Company → About. Restyled onto the shared marketing design system;
 * every line of copy is carried over from the previous landing page.
 */

const STATS = [
  { value: '15+', label: 'Years in Business' },
  { value: '50,000+', label: 'Active Traders' },
  { value: '150+', label: 'Countries Served' },
  { value: '2.3B+', label: 'Daily Trading Volume' },
];

const ACCOUNT_TYPES = [
  {
    icon: Wallet,
    name: 'Standard',
    min: '$50',
    tagline: 'Designed for new traders',
    points: ['Competitive spreads from 1.1 pips', 'Zero commission', 'Full platform access', '24/7 multilingual support'],
  },
  {
    icon: Zap,
    name: 'ECN',
    min: '$200',
    tagline: 'Raw spreads for serious traders',
    popular: true,
    points: ['Raw spreads from 0.0 pips', 'Direct liquidity access', 'Ultra-low commission per lot', 'Scalping and algo trading allowed'],
  },
  {
    icon: Handshake,
    name: 'IB',
    min: '$50',
    tagline: 'For partners and introducing brokers',
    points: ['Lifetime per-lot commissions', 'Multi-tier earnings', 'Marketing kit and dashboard', 'Dedicated partner manager'],
  },
  {
    icon: Moon,
    name: 'Swap',
    min: '$200',
    tagline: 'Sharia-compliant · Swap-free',
    points: ['Zero overnight swap charges', 'Sharia-compliant trading', 'Full platform & instrument access', 'Hold positions indefinitely'],
  },
];

export default function AboutUsPage() {
  return (
    <main>
      <PageHero
        kicker={`About ${BRAND_NAME}`}
        title={`Who We Are — ${BRAND_NAME}`}
        lead="A globally regulated forex and CFD broker — and a decentralized exchange with on-chain insured trades — committed to transparency, innovation, and excellence."
        primary={{ label: 'Open Account', href: '/auth/register' }}
        secondary={{ label: 'Compare All Accounts', href: '/account-types' }}
      />

      {/* Story + headline numbers */}
      <Section raised>
        <div className="flex flex-col gap-6 mx-auto max-w-4xl">
          <p className="mk-lead">
            Founded in 2010, {BRAND_NAME} is a globally regulated forex and CFD broker headquartered at
            Office 23US, 18 Young St, UNIT LGE 1/1, Edinburgh EH2 4JB, Scotland, and a decentralized
            exchange offering on-chain insured trades and non-custodial wallet trading. With over
            500,000 clients across 150+ countries, we&apos;ve built our reputation on transparency,
            speed, and trust.
          </p>
          <p className="mk-lead">
            Our mission is to democratize access to global financial markets by providing cutting-edge
            technology, competitive pricing, and world-class support. Whether you&apos;re a beginner
            taking your first steps in trading or a seasoned professional, {BRAND_NAME} provides the
            tools, platforms, and expertise you need to succeed.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
          {STATS.map((s) => (
            <div key={s.label} className="mk-card text-center">
              <div
                className="font-extrabold"
                style={{ fontSize: 'var(--mk-text-h2)', color: 'var(--mk-accent)', lineHeight: 1.1 }}
              >
                {s.value}
              </div>
              <div
                className="mt-2"
                style={{
                  fontSize: 'var(--mk-text-label)',
                  letterSpacing: 'var(--mk-tracking-label)',
                  textTransform: 'uppercase',
                  color: 'var(--mk-text-faint)',
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Mission & vision */}
      <Section>
        <SectionHeading kicker="Purpose" title="Our Mission & Vision" />
        <div className="grid md:grid-cols-2 gap-5 mt-12">
          <article className="mk-card mk-card--hover flex flex-col gap-3">
            <span
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
              style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
            >
              <Award size={20} />
            </span>
            <h3 className="mk-h3">Our Mission</h3>
            <p className="mk-body">
              To empower traders worldwide with transparent, reliable, and innovative trading solutions
              that enable them to achieve their financial goals with confidence.
            </p>
          </article>
          <article className="mk-card mk-card--hover flex flex-col gap-3">
            <span
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
              style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
            >
              <TrendingUp size={20} />
            </span>
            <h3 className="mk-h3">Our Vision</h3>
            <p className="mk-body">
              To become the world&apos;s most trusted and technologically advanced trading platform,
              setting new standards for excellence in the financial services industry.
            </p>
          </article>
        </div>

        <FeatureGrid
          className="mt-5"
          columns={3}
          items={[
            {
              icon: Users,
              title: 'Client-Focused',
              body: 'Your success is our priority. We’re committed to providing exceptional service and support.',
            },
            {
              icon: Globe,
              title: 'Global Reach',
              body: 'Serving traders in 150+ countries with localized support and multilingual platforms.',
            },
            {
              icon: Award,
              title: 'Award-Winning',
              body: 'Recognized by industry leaders for excellence in trading technology and customer service.',
            },
          ]}
        />
      </Section>

      {/* Account ladder */}
      <Section raised>
        <SectionHeading
          kicker="Accounts"
          title="Account Types for Every Trader"
          lead="Start small with a Standard account, scale up to ECN raw spreads, partner with us through the IB program, or hold positions overnight on the swap-free Swap account — same platform, same execution, different conditions."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
          {ACCOUNT_TYPES.map((a) => (
            <article
              key={a.name}
              className="mk-card mk-card--hover flex flex-col gap-3"
              style={a.popular ? { borderColor: 'var(--mk-accent-line)' } : undefined}
            >
              {a.popular && (
                <span
                  className="self-start rounded-full px-2.5 py-1 font-bold uppercase"
                  style={{
                    background: 'var(--mk-accent)',
                    color: '#fff',
                    fontSize: '10px',
                    letterSpacing: '0.12em',
                  }}
                >
                  Most Popular
                </span>
              )}
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
                style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
              >
                <a.icon size={20} />
              </span>
              <div>
                <h3 className="mk-h3">{a.name}</h3>
                <div
                  className="font-extrabold"
                  style={{ color: 'var(--mk-accent)', fontSize: 'var(--mk-text-h3)' }}
                >
                  {a.min}
                </div>
                <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{a.tagline}</p>
              </div>
              <ul className="flex flex-col gap-2 mt-1">
                {a.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
                    <span
                      className="mt-2 h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ background: 'var(--mk-accent)' }}
                    />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <div className="text-center mt-10">
          <Link href="/account-types" className="mk-btn mk-btn--ghost">Compare All Accounts</Link>
        </div>
      </Section>

      <CtaBanner
        title={`Join the ${BRAND_NAME} Family`}
        lead="Experience the difference of trading with a broker that puts your success first."
        primary={{ label: 'Open Account Now', href: '/auth/register' }}
        secondary={{ label: 'Contact Us', href: '/company/contact' }}
      />
    </main>
  );
}
