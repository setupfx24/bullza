'use client';

import { useState, type ReactNode } from 'react';
import { Quote } from 'lucide-react';

/**
 * Famous-investor quote band. Drop in any page — accepts a custom quote,
 * author, role, portrait, and initials. Defaults render the Warren
 * Buffett "Rule No. 1" quote used on the homepage.
 */
interface QuoteSectionProps {
  /** Pre-formatted JSX so brand-green highlight spans can sit inline. */
  quote?: ReactNode;
  author?: string;
  role?: string;
  portrait?: string;
  /** Two-letter initials shown if the portrait image fails to load. */
  initials?: string;
  /** Small uppercase eyebrow label above the headline (default "Investor Wisdom"). */
  eyebrow?: string;
}

export function QuoteSection({
  quote,
  author = 'Warren Buffett',
  role = 'Chairman & CEO — Berkshire Hathaway',
  portrait: portraitProp = '/images/image1.png',
  initials = 'WB',
  eyebrow = 'Investor Wisdom',
}: QuoteSectionProps = {}) {
  const [imgErrored, setImgErrored] = useState(false);
  const portrait = portraitProp;
  const defaultQuote = (
    <>
      &ldquo;Rule No. 1 is <span className="text-primary font-bold">never lose money.</span>{' '}
      Rule No. 2 is <span className="text-primary font-bold">never forget</span> Rule No. 1.&rdquo;
    </>
  );

  return (
    <section className="relative px-3 sm:px-6 py-10 sm:py-16 md:py-20">
      <div
        className="max-w-[1200px] mx-auto rounded-3xl overflow-hidden relative"
        style={{
          background:
            'linear-gradient(135deg, hsl(99 35% 18%) 0%, hsl(0 0% 8%) 55%, hsl(0 60% 14%) 100%)',
          border: '1px solid hsl(99 55% 42% / 0.35)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
        }}
      >
        {/* Subtle decorative ring on the right side (mirrors the reference design) */}
        <div
          aria-hidden
          className="absolute -right-24 -top-24 size-[360px] rounded-full pointer-events-none hidden md:block"
          style={{
            border: '1px solid hsl(99 55% 42% / 0.25)',
            background:
              'radial-gradient(circle at 50% 50%, hsl(99 55% 42% / 0.08) 0%, transparent 60%)',
          }}
        />
        <div
          aria-hidden
          className="absolute -right-44 top-12 size-[300px] rounded-full pointer-events-none hidden md:block"
          style={{ border: '1px solid hsl(99 55% 42% / 0.18)' }}
        />

        <div className="relative grid md:grid-cols-[2fr_1fr] gap-6 sm:gap-10 p-5 sm:p-10 md:p-14 items-center">
          {/* Left — quote */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <img
                src="/images/swisdex-logo1.png"
                alt="SwisDex"
                className="h-7 w-auto opacity-90"
              />
              <span className="text-[11px] uppercase tracking-[0.22em] text-foreground/55 font-semibold ml-2">
                {eyebrow}
              </span>
            </div>

            <Quote className="size-7 text-primary/70 mb-4" aria-hidden />

            <blockquote className="font-display text-xl sm:text-3xl md:text-[40px] lg:text-5xl leading-[1.15] sm:leading-[1.12] text-foreground tracking-tight max-w-none break-words">
              {quote ?? defaultQuote}
            </blockquote>

            <div className="mt-7 flex items-center gap-3">
              <div className="h-px w-10 bg-primary/60" />
              <div>
                <div className="font-display uppercase text-sm tracking-tight text-foreground">
                  {author}
                </div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-foreground/55">
                  {role}
                </div>
              </div>
            </div>
          </div>

          {/* Right — portrait (image with initials fallback) */}
          <div className="relative flex justify-center md:justify-end">
            <div
              className="size-[180px] sm:size-[220px] md:size-[260px] rounded-2xl overflow-hidden flex items-center justify-center font-display font-bold"
              style={{
                background: imgErrored
                  ? 'linear-gradient(135deg, hsl(99 55% 42% / 0.25) 0%, hsl(0 0% 8%) 100%)'
                  : 'transparent',
                color: 'hsl(99 60% 78%)',
                border: '1px solid hsl(99 55% 42% / 0.4)',
                boxShadow: '0 12px 30px rgba(0,0,0,0.4)',
              }}
              aria-hidden
            >
              {!imgErrored ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={portrait}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={() => setImgErrored(true)}
                />
              ) : (
                <span className="text-5xl sm:text-6xl">{initials}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
