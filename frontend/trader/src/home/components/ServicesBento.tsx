'use client';

import Link from 'next/link';
import {
  ArrowUpRight,
  BarChart2,
  Building,
  Cpu,
  Gem,
  Layers,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { Section, SectionHeading } from '@/marketing/components';
import { INSTRUMENTS } from '../data';
import { BRAND_NAME } from '@/lib/brand';

const iconMap: Record<string, LucideIcon> = {
  TrendingUp,
  Gem,
  BarChart2,
  Cpu,
  Building,
  Layers,
};

type Service = (typeof INSTRUMENTS)[number];

/**
 * Same visual contract as the shared <FeatureGrid />, but each card is a
 * link — FeatureGrid has no href slot and lives outside this scope, so
 * the card markup is mirrored here rather than forked upstream.
 */
function ServiceCard({ service }: { service: Service }) {
  const Icon = iconMap[service.icon] ?? TrendingUp;
  const comingSoon = (service as { comingSoon?: boolean }).comingSoon === true;

  return (
    <Link
      href={service.href}
      className="mk-card mk-card--hover group relative flex flex-col"
      style={{ gap: 'var(--mk-space-3)' }}
    >
      <span
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
      >
        <Icon size={20} />
      </span>

      <h3 className="mk-h3" style={{ paddingRight: '2rem' }}>{service.title}</h3>
      <p className="mk-body">{service.body}</p>

      <span
        className="inline-flex w-fit items-center rounded-full uppercase font-bold"
        style={{
          gap: 'var(--mk-space-2)',
          marginTop: 'var(--mk-space-2)',
          padding: '0.3rem 0.7rem',
          fontSize: 'var(--mk-text-label)',
          letterSpacing: 'var(--mk-tracking-label)',
          background: comingSoon ? 'var(--mk-accent-soft)' : 'var(--mk-surface-2)',
          border: `1px solid ${comingSoon ? 'var(--mk-accent-line)' : 'var(--mk-line)'}`,
          color: comingSoon ? 'var(--mk-accent)' : 'var(--mk-text-faint)',
        }}
      >
        {comingSoon && (
          <span className="relative inline-flex items-center justify-center" aria-hidden>
            <span
              className="absolute size-1.5 rounded-full animate-ping opacity-75"
              style={{ background: 'var(--mk-accent)' }}
            />
            <span className="relative size-1.5 rounded-full" style={{ background: 'var(--mk-accent)' }} />
          </span>
        )}
        {service.badge}
      </span>

      <ArrowUpRight
        size={18}
        aria-hidden
        className="absolute right-6 top-6 transition-colors"
        style={{ color: 'var(--mk-text-faint)' }}
      />
    </Link>
  );
}

export function ServicesBento() {
  return (
    <Section id="services">
      <SectionHeading
        kicker="What We Offer"
        title="Everything you need, on one platform"
        lead={`From expert portfolio oversight to daily research and education — ${BRAND_NAME} delivers the full investment toolkit without bolting on a second provider.`}
      />
      <div
        className="grid grid-cols-1 sm:grid-cols-2"
        style={{ gap: 'var(--mk-space-5)', marginTop: 'var(--mk-space-7)' }}
      >
        {INSTRUMENTS.map((service) => (
          <ServiceCard key={service.title} service={service} />
        ))}
      </div>
    </Section>
  );
}
