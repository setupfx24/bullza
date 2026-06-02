'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export default function InsurancePage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero banner — replaces the previous BannerPlaceholder */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pt-24 sm:pt-28">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/insurance_banner1.png"
          alt="SwisDex Trade Insurance — protect every position"
          className="w-full rounded-3xl"
          style={{ border: '1px solid rgba(255,255,255,0.06)' }}
        />
      </section>

      {/* Black-box content placeholder — drop the final Insurance table / copy here */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div
          aria-label="Insurance content placeholder"
          className="w-full rounded-3xl"
          style={{
            background: '#000',
            border: '1px solid rgba(255,255,255,0.06)',
            minHeight: 'min(720px, 80vh)',
          }}
        />
        <p className="mt-4 text-center text-xs text-foreground/45">
          Final content drop pending — replace this black box with the Insurance table / page content.
        </p>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pb-20">
        <div className="liquid-glass-strong rounded-3xl p-8 sm:p-12 text-center">
          <h2 className="font-display uppercase text-2xl sm:text-3xl tracking-tight">
            Trade With Built-In Protection
          </h2>
          <p className="mt-4 text-foreground/70 max-w-xl mx-auto text-sm sm:text-base">
            Open a SwisDex account — every position you open is automatically policy-backed by on-chain trade insurance.
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
