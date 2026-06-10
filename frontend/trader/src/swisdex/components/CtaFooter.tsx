'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { ArrowUpRight, Facebook, Instagram, Linkedin, Youtube } from 'lucide-react';
import { Button } from '../ui/Button';
import { BlurText } from './BlurText';
import {
  CTA,
  FOOTER_LINKS,
  COPYRIGHT,
  BRAND,
  FOOTER_QUICK_LINKS,
  FOOTER_SERVICES,
  RISK_DISCLAIMER,
} from '../data';
import { TrustBadges } from './TrustBadges';
import { AppStoreButtons } from './AppStoreButtons';

export function CtaFooter() {
  return (
    <section id="cta" className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Solid black backdrop with brand-tinted gradient */}
      <div
        className="absolute inset-0 w-full h-full"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 50%, rgba(85,166,48,0.12) 0%, rgba(0,0,0,0.7) 60%, #000 100%)',
        }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-background/30" />
      <div className="absolute top-0 inset-x-0 h-[200px] gradient-fade-t pointer-events-none" />
      <div className="absolute bottom-0 inset-x-0 h-[200px] gradient-fade-b pointer-events-none" />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 sm:px-6 py-16 sm:py-24 md:py-32">
        <BlurText
          text={CTA.headline}
          as="h2"
          className="font-display italic text-[clamp(36px,9vw,140px)] leading-[0.92] tracking-[-0.02em] text-center max-w-[18ch] text-foreground break-words"
        />
        <motion.p
          initial={{ filter: 'blur(10px)', opacity: 0, y: 16 }}
          whileInView={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ delay: 0.4, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8 font-body text-base md:text-lg text-foreground/75 max-w-xl text-center"
        >
          {CTA.sub}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="mt-10 flex items-center gap-3 flex-wrap justify-center"
        >
          <Button variant="hero" asChild>
            <Link href={CTA.href}>
              {CTA.primary}
              <ArrowUpRight className="ml-1 size-4" />
            </Link>
          </Button>
        </motion.div>
      </div>

      <AppStoreButtons />
      <TrustBadges />

      <div className="relative z-10 w-full border-t border-border">
        <div
          className="max-w-[var(--max)] mx-auto pt-16 pb-10"
          style={{ paddingLeft: 'var(--gutter)', paddingRight: 'var(--gutter)' }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 md:gap-8 mb-12">
            <div className="lg:col-span-2 flex flex-col gap-4">
              <Link href="/" className="flex items-center gap-2">
                <img
                  src={BRAND.logo}
                  alt={BRAND.name}
                  className="h-9 w-auto object-contain hidden dark:block"
                />
                <img
                  src="/images/swisdex_png.png"
                  alt={BRAND.name}
                  className="h-9 w-auto object-contain dark:hidden"
                />
              </Link>
              <p className="font-body text-sm text-foreground/65 max-w-sm leading-relaxed">
                SwisDex is an institutional-grade forex, CFD broker, and decentralized exchange built for serious traders. It offers fast execution, low spreads, transparent pricing, insured trades, and fully automated trading with no human intervention.
              </p>
              <p className="font-body text-sm text-foreground/65 max-w-sm leading-relaxed">
                SwisDex also provides staking with fixed monthly income, anytime withdrawals, and a rewarding IB (Introducing Broker) program with profit-sharing opportunities for partners and affiliates.
              </p>
              <div className="flex items-center gap-3 mt-2">
                {[
                  { Icon: Facebook,  label: 'Facebook',  href: 'https://www.facebook.com/profile.php?id=61589880747321' },
                  { Icon: Instagram, label: 'Instagram', href: 'https://www.instagram.com/swisdex/' },
                  { Icon: Linkedin,  label: 'LinkedIn',  href: 'https://www.linkedin.com/in/swis-dex-a62208410/' },
                  { Icon: Youtube,   label: 'YouTube',   href: 'https://youtube.com/@swisdex-u7q' },
                ].map(({ Icon, label, href }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="liquid-glass rounded-full size-9 flex items-center justify-center text-foreground/70 hover:text-foreground transition-colors"
                  >
                    <Icon className="size-4" />
                  </a>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <span className="font-display uppercase text-xs tracking-wider text-foreground/55 mb-1">
                Quick Links
              </span>
              {FOOTER_QUICK_LINKS.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  className="font-body text-sm text-foreground/70 hover:text-foreground transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <span className="font-display uppercase text-xs tracking-wider text-foreground/55 mb-1">
                Our Services
              </span>
              {FOOTER_SERVICES.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  className="font-body text-sm text-foreground/70 hover:text-foreground transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <span className="font-display uppercase text-xs tracking-wider text-foreground/55 mb-1">
                Contact
              </span>
              <span className="font-body text-sm text-foreground/70">info@swisdex.com</span>
              <span className="font-body text-sm text-foreground/70 leading-relaxed">
                SwisDex Office 23US,<br />
                18 Young St, UNIT LGE 1/1,<br />
                Edinburgh EH2 4JB, Scotland
              </span>
              <span className="font-body text-sm text-foreground/70">24/7 Available</span>
            </div>
          </div>

          {/* Legal / Policy quick-links — each opens the official signed
              PDF in a new tab. Drop replacement files at /public/pdfs/terms/
              with the exact filenames used below. */}
          <nav
            aria-label="Legal documents"
            className="border-t border-border pt-8 flex flex-wrap gap-x-7 gap-y-3"
          >
            {[
              { name: 'Privacy Policy',              href: '/pdfs/terms/privcy%20policy.pdf' },
              { name: 'Terms & Conditions',          href: '/pdfs/terms/terms%20and%20condition.pdf' },
              { name: 'AML Policy',                  href: '/pdfs/terms/aml-policy.pdf' },
              { name: 'Deposit & withdrawal Policy', href: '/pdfs/terms/deposit%20and%20withdrawal.pdf' },
              { name: 'Restricted Countries',        href: '/pdfs/terms/restricted-countries.pdf' },
              { name: 'Risk Warning',                href: '/pdfs/terms/risk-warning.pdf' },
              { name: 'Legal Documents',             href: '/pdfs/terms/SwisDex%20Promotional%20%26%20Service%20Terms%20and%20Conditions.pdf' },
              { name: 'Risk Disclosure',             href: '/pdfs/terms/Client%20Fund%20Security.pdf' },
            ].map((doc) => (
              <a
                key={doc.name}
                href={doc.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-body text-sm font-semibold text-foreground/90 hover:text-foreground hover:underline transition-colors"
              >
                {doc.name}
              </a>
            ))}
          </nav>

          <div className="border-t border-border pt-8 mt-6 flex flex-col gap-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <span className="font-body text-xs text-foreground/55 max-w-2xl">
                {COPYRIGHT}
              </span>
            </div>
            <p className="font-body text-[11px] text-foreground/40 leading-relaxed max-w-4xl">
              {RISK_DISCLAIMER}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
