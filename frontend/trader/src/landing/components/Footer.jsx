import { Link } from 'react-router-dom'
import { Twitter, Linkedin, Instagram, Youtube, Mail } from 'lucide-react'
import ScrollReveal from './animations/ScrollReveal'

const columns = {
  Trading: [
    { name: 'Forex',       path: '/trading/forex' },
    { name: 'Indices',     path: '/trading/indices' },
    { name: 'Commodities', path: '/trading/commodities' },
    { name: 'Crypto',      path: '/trading/crypto' },
  ],
  Platforms: [
    { name: 'Web Platform',  path: '/platforms/web' },
    { name: 'Copy Trading',  path: '/platforms/copy-trading' },
    { name: 'Prop Trading',  path: '/platforms/prop-trading' },
    { name: 'IB Management', path: '/platforms/ib-management' },
  ],
  Accounts: [
    { name: 'Standard', path: '/accounts/standard' },
    { name: 'Pro',      path: '/accounts/pro' },
    { name: 'Demo',     path: '/accounts/demo' },
  ],
  Company: [
    { name: 'About Us',       path: '/company/about' },
    { name: 'Why SwisDex',    path: '/company/why-swisdex' },
    { name: 'Contact',        path: '/company/contact' },
  ],
  Education: [
    { name: 'Tutorials',   path: '/education/tutorials' },
    { name: 'Blog',        path: '/education/blog' },
    { name: 'Market News', path: '/education/news' },
  ],
}

const socials = [
  { icon: Twitter,   href: '#', label: 'Twitter' },
  { icon: Linkedin,  href: '#', label: 'LinkedIn' },
  { icon: Instagram, href: '#', label: 'Instagram' },
  { icon: Youtube,   href: '#', label: 'YouTube' },
]

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer
      className="relative"
      style={{
        background: 'linear-gradient(180deg, var(--fx-bg) 0%, #050608 100%)',
        borderTop: '1px solid var(--fx-line)',
      }}
    >
      <div className="fx-divider-gold" />

      <div className="fx-container py-14 md:py-20">
        {/* Top: brand + columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-10 lg:gap-8">
          {/* Brand block — spans more on mobile */}
          <div className="col-span-2 lg:col-span-2">
            <ScrollReveal variant="fadeLeft">
              <Link to="/" className="inline-block mb-5" aria-label="SwisDex home">
                <img src="/images/swisdex-logo.png" alt="SwisDex" className="h-10 w-auto" />
              </Link>
              <p className="text-sm leading-relaxed max-w-sm mb-6" style={{ color: 'var(--fx-text-2)' }}>
                SwisDex is an institutional-grade forex and CFD broker. Built for serious
                traders who demand fast execution, transparent pricing, and a platform that
                works as hard as they do.
              </p>

              <div className="flex items-center gap-2 text-sm mb-5" style={{ color: 'var(--fx-text-3)' }}>
                <Mail size={14} style={{ color: 'var(--fx-gold-light)' }} />
                <a href="mailto:support@swisdex.com" className="hover:underline" style={{ color: 'var(--fx-text-2)' }}>
                  support@swisdex.com
                </a>
              </div>

              <div className="flex items-center gap-2.5">
                {socials.map(({ icon: Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    aria-label={label}
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--fx-line-strong)',
                      color: 'var(--fx-text-2)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--fx-gold-light)'
                      e.currentTarget.style.borderColor = 'rgba(85,166,48,0.4)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--fx-text-2)'
                      e.currentTarget.style.borderColor = 'var(--fx-line-strong)'
                    }}
                  >
                    <Icon size={15} />
                  </a>
                ))}
              </div>
            </ScrollReveal>
          </div>

          {/* Link columns */}
          {Object.entries(columns).map(([heading, links], i) => (
            <ScrollReveal key={heading} variant="fadeUp" delay={0.05 + i * 0.05}>
              <h3
                className="text-xs uppercase tracking-[0.16em] font-semibold mb-4"
                style={{ color: 'var(--fx-gold-light)' }}
              >
                {heading}
              </h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.path}>
                    <Link
                      to={link.path}
                      className="text-sm transition-colors"
                      style={{ color: 'var(--fx-text-2)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fx-text)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fx-text-2)' }}
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </ScrollReveal>
          ))}
        </div>

        {/* Risk warning + Restricted regions */}
        <div
          className="mt-12 md:mt-16 p-6 md:p-8 rounded-2xl space-y-7"
          style={{
            background: 'var(--fx-bg-elev)',
            border: '1px solid var(--fx-line)',
          }}
        >
          <div>
            <h3
              className="text-lg md:text-xl font-semibold mb-3"
              style={{ color: 'var(--fx-text)' }}
            >
              Risk Warning
            </h3>
            <p className="text-xs md:text-[13px] leading-relaxed" style={{ color: 'var(--fx-text-3)' }}>
              Please note that forex trading and trading in other leveraged products involves a
              significant level of risk and is not suitable for all investors. Trading in financial
              instruments may result in losses as well as profits and your losses can be greater than
              your initial invested capital. Before undertaking any such transactions, you should
              ensure that you fully understand the risks involved and seek independent advice if
              necessary. SwisDex does not provide investment advice.
            </p>
          </div>

          <div>
            <h3
              className="text-lg md:text-xl font-semibold mb-3"
              style={{ color: 'var(--fx-text)' }}
            >
              Restricted Regions
            </h3>
            <p className="text-xs md:text-[13px] leading-relaxed" style={{ color: 'var(--fx-text-3)' }}>
              SwisDex Ltd does not provide services for citizens/residents of the USA, Cuba, Iraq,
              Myanmar, North Korea, and Sudan. The services of SwisDex Ltd are not intended for
              distribution to, or use by, any person in any country or jurisdiction where such
              distribution or use would be contrary to local law or regulation.
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="mt-10 pt-6 flex flex-col md:flex-row gap-3 md:gap-6 items-start md:items-center justify-between"
          style={{ borderTop: '1px solid var(--fx-line)' }}
        >
          <p className="text-xs" style={{ color: 'var(--fx-text-3)' }}>
            © {year} SwisDex Ltd. All rights reserved. · Founded in 2010
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs" style={{ color: 'var(--fx-text-3)' }}>
            <Link to="/privacy" className="hover:underline">Privacy Policy</Link>
            <Link to="/terms" className="hover:underline">Terms of Service</Link>
            <Link to="/risk" className="hover:underline">Risk Disclosure</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
