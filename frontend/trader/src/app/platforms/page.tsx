import LandingHeader from '@/components/landing/LandingHeader'
import LandingFooter from '@/components/landing/LandingFooter'
import { Monitor, Smartphone, Globe, Zap, BarChart3, Shield } from 'lucide-react'
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components'
import { BRAND_NAME } from '@/lib/brand'
import '@/marketing/tokens.css'

/**
 * Standalone /platforms. Restyled onto the shared marketing design system —
 * the body is wrapped in `.mk` so it picks up the marketing tokens (this
 * route sits outside the (landing) group, which normally applies them).
 * All copy and links carried over unchanged.
 *
 * LandingHeader / LandingFooter keep their own existing styling; they are
 * shared chrome outside this restyle's scope.
 */

export const metadata = { title: `Trading Platforms — ${BRAND_NAME}` }

const PLATFORMS = [
  {
    icon: Monitor,
    title: 'Desktop Terminal',
    desc: 'Full-featured trading platform with advanced charting, automated trading, and customizable workspaces.',
    features: ['100+ Chart Tools', '50+ Indicators', 'Algorithmic Trading', 'Custom Workspaces'],
  },
  {
    icon: Smartphone,
    title: 'Mobile Trading',
    desc: 'Trade on the go with our powerful mobile app. Full functionality in your pocket.',
    features: ['Real-time Quotes', 'Push Notifications', 'One-Click Trading', 'Biometric Login'],
  },
  {
    icon: Globe,
    title: 'Web Platform',
    desc: 'Access your account from any browser. No download required, instant access.',
    features: ['Browser-based', 'No Installation', 'Full Features', 'Secure Trading'],
  },
]

export default function PlatformsPage() {
  return (
    <div className="min-h-screen">
      <LandingHeader />

      <div className="mk">
        <PageHero
          kicker="Cross-Platform Trading"
          title={<>Professional Trading Terminals<br /><span style={{ color: 'var(--mk-accent)' }}>for All Traders</span></>}
          lead="Access institutional-grade platforms on desktop, web, and mobile. 100+ chart tools, 50+ indicators, and execution speeds under 40ms."
          primary={{ label: 'Open Live Account', href: '/auth/register' }}
          secondary={{ label: 'Try Demo', href: '/auth/login' }}
        />

        {/* Platform Cards */}
        <Section raised>
          <SectionHeading kicker="Terminals" title="Trade on Any Device" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-12">
            {PLATFORMS.map(({ icon: Icon, title, desc, features }) => (
              <article key={title} className="mk-card mk-card--hover flex flex-col gap-4">
                <span
                  className="inline-flex h-14 w-14 items-center justify-center rounded-xl shrink-0"
                  style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mk-h3">{title}</h3>
                <p className="mk-body">{desc}</p>
                <ul className="flex flex-col gap-2 mt-auto">
                  {features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2 mk-body"
                      style={{ fontSize: 'var(--mk-text-sm)' }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'var(--mk-accent)' }} />
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </Section>

        {/* Features */}
        <Section>
          <SectionHeading
            kicker="Features"
            title="Platform Features"
            lead="Everything you need for professional trading, built by traders for traders."
          />
          <FeatureGrid
            className="mt-12"
            columns={3}
            items={[
              { icon: Zap,        title: 'Lightning Fast',     body: 'Execute trades in under 40ms with our optimized infrastructure.' },
              { icon: BarChart3,  title: 'Advanced Charting',  body: '100+ drawing tools and 50+ technical indicators.' },
              { icon: Shield,     title: 'Secure Trading',     body: 'Bank-level security with 2FA and encryption.' },
              { icon: Monitor,    title: 'Multi-Monitor',      body: 'Support for up to 4 monitors with customizable layouts.' },
              { icon: Smartphone, title: 'Mobile Sync',        body: 'Seamless synchronization across all devices.' },
              { icon: Globe,      title: 'Global Markets',     body: 'Access 50+ forex pairs, crypto, metals, and indices.' },
            ]}
          />
        </Section>

        <CtaBanner
          title="Ready to Start Trading?"
          lead="Experience professional trading platforms with institutional-grade features."
          primary={{ label: 'Open Live Account', href: '/auth/register' }}
          secondary={{ label: 'Try Demo', href: '/auth/login' }}
        />
      </div>

      <LandingFooter />
    </div>
  )
}
