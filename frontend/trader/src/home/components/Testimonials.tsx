'use client';

import { useState } from 'react';
import { Quote, Star } from 'lucide-react';
import { BlurText } from './BlurText';
import { TESTIMONIALS } from '../data';
import { BRAND_NAME } from '@/lib/brand';

type T = (typeof TESTIMONIALS)[number];

/** Two-letter initials from a full name, used as the avatar fallback. */
function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function Avatar({ name, src }: { name: string; src?: string }) {
  // If the real image fails to load (e.g. file not dropped yet),
  // fall back to a brand-styled initials circle.
  const [errored, setErrored] = useState(false);
  const showImg = src && !errored;
  return (
    <div
      className="size-12 rounded-full overflow-hidden shrink-0 flex items-center justify-center font-display font-semibold text-sm"
      style={{
        background: showImg ? 'transparent' : 'hsl(99 55% 42% / 0.22)',
        color: 'hsl(99 60% 78%)',
        border: '1px solid hsl(99 55% 42% / 0.35)',
      }}
      aria-hidden
    >
      {showImg ? (
        // TODO: drop avatar at /images/testimonials/<slug>.webp
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        <span>{initials(name)}</span>
      )}
    </div>
  );
}

function Card({ t }: { t: T }) {
  return (
    <div className="liquid-glass rounded-2xl p-5 sm:p-7 w-[280px] sm:w-[340px] md:w-[400px] shrink-0 flex flex-col gap-4 min-h-[220px] sm:min-h-[240px]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={t.name} src={t.avatar} />
          <div className="min-w-0">
            <div className="font-display text-sm uppercase tracking-tight text-foreground truncate">
              {t.name}
            </div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-foreground/55 truncate">
              {t.role}
            </div>
          </div>
        </div>
        <Quote className="size-5 text-primary/70 shrink-0" aria-hidden />
      </div>
      <p className="font-body text-foreground/85 italic leading-relaxed text-[15px]">
        &ldquo;{t.quote}&rdquo;
      </p>
      <div className="mt-auto flex gap-1 text-primary" aria-label="5 out of 5 stars">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="size-4 fill-current" aria-hidden />
        ))}
      </div>
    </div>
  );
}

export function Testimonials() {
  const rowA = [...TESTIMONIALS, ...TESTIMONIALS];
  const half = Math.ceil(TESTIMONIALS.length / 2);
  const tail = TESTIMONIALS.slice(half).concat(TESTIMONIALS.slice(0, half));
  const rowB = [...tail, ...tail];

  return (
    <section id="testimonials" className="relative py-16 sm:py-24 md:py-32 lg:py-40 border-t border-border">
      <div
        className="max-w-[var(--max)] mx-auto"
        style={{ paddingLeft: 'var(--gutter)', paddingRight: 'var(--gutter)' }}
      >
        <div className="flex flex-col items-center gap-5 mb-10 sm:mb-14 md:mb-20 text-center">
          <span className="liquid-glass rounded-full px-4 py-1.5 text-xs text-foreground/80">
            Investor Stories
          </span>
          <BlurText
            text="What Our Investors Say"
            as="h2"
            className="font-display uppercase text-3xl sm:text-4xl md:text-6xl leading-[0.9] tracking-tight max-w-[20ch]"
          />
          <p className="font-body text-foreground/60 max-w-xl">
            Over 10,000 investors worldwide trust {BRAND_NAME} with their portfolios. Here is what they say.
          </p>
        </div>
      </div>

      <div className="group relative flex flex-col gap-5 overflow-hidden marquee-mask">
        <div
          className="flex gap-5 w-max group-hover:[animation-play-state:paused]"
          style={{ animation: 'var(--animate-marquee)' }}
        >
          {rowA.map((t, i) => (
            <Card key={`a-${i}`} t={t} />
          ))}
        </div>
        <div
          className="flex gap-5 w-max group-hover:[animation-play-state:paused]"
          style={{ animation: 'var(--animate-marquee-rev)' }}
        >
          {rowB.map((t, i) => (
            <Card key={`b-${i}`} t={t} />
          ))}
        </div>
      </div>
    </section>
  );
}
