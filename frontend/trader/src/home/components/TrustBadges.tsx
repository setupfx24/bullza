'use client';

/**
 * "Trusted By" partner-logo band — a quiet, continuously scrolling
 * marquee. Rendered on the homepage (via HomePage) and above the footer
 * on every inner landing page (via the (landing) layout).
 *
 * The logos are decorative marks only; no partner claim is made in copy.
 */
type Badge = { label?: string; logo: string };

const BADGES: Badge[] = [
  { logo: '/images/b5.png' },
  { logo: '/images/b6.png' },
  { logo: '/images/b7.png' },
  { logo: '/images/bit_icon.png' },
  { logo: '/images/b2.png' },
  { logo: '/images/b3.png' },
  { logo: '/images/b4.png' },
  { logo: '/images/b8.png' },
  { logo: '/images/b9.png' },
  { logo: '/images/b10.png' },
  { logo: '/images/b11.png' },
];

/* Rendered twice back-to-back so translateX(-50%) loops seamlessly. */
const TRACK = [...BADGES, ...BADGES];

const FADE =
  'linear-gradient(to right, transparent, #000 10%, #000 90%, transparent)';

export function TrustBadges() {
  return (
    <section
      aria-label="Trusted by partners"
      className="relative overflow-hidden"
      style={{
        paddingBlock: 'var(--mk-space-8)',
        background: 'var(--mk-bg-raised)',
        borderBlock: '1px solid var(--mk-line)',
      }}
    >
      <p
        className="mk-container text-center uppercase font-semibold"
        style={{
          fontSize: 'var(--mk-text-label)',
          letterSpacing: 'var(--mk-tracking-label)',
          color: 'var(--mk-text-faint)',
          marginBottom: 'var(--mk-space-6)',
        }}
      >
        Trusted By
      </p>

      <div
        className="group relative w-full overflow-hidden"
        style={{ maskImage: FADE, WebkitMaskImage: FADE }}
      >
        <div
          className="flex w-max items-center group-hover:[animation-play-state:paused]"
          style={{
            gap: 'var(--mk-space-7)',
            animation: 'brand-marquee 42s linear infinite',
          }}
        >
          {TRACK.map(({ label, logo }, i) => (
            <span
              key={`${logo}-${i}`}
              className="shrink-0 opacity-55 transition-opacity duration-200 hover:opacity-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logo}
                alt={label ?? ''}
                className="h-10 sm:h-12 w-auto max-w-[120px] object-contain"
                aria-hidden={!label}
                loading="lazy"
                decoding="async"
              />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
