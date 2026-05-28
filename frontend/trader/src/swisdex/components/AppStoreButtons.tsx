'use client';

/**
 * Twin App Store / Google Play download badges.
 * Sits just above the TrustBadges row on every public landing page.
 * Currently the hrefs are placeholders — swap them when the iOS and
 * Android builds land in their respective stores. Uses the official
 * branded store badges (drop replacements at /public/images/).
 */
const STORES = [
  { src: '/images/app_store.png',   alt: 'Download on the App Store',     href: '#' },
  { src: '/images/google_play.png', alt: 'Get it on Google Play',         href: '#' },
];

export function AppStoreButtons() {
  return (
    <section
      aria-label="Download our mobile apps"
      className="relative pt-12 sm:pt-16 pb-2"
    >
      <div
        className="mx-auto"
        style={{
          maxWidth: 'var(--max)',
          paddingLeft: 'var(--gutter)',
          paddingRight: 'var(--gutter)',
        }}
      >
        {/* Section eyebrow — matches the "Trusted By" label styling below */}
        <p className="text-center text-[11px] uppercase tracking-[0.24em] text-foreground/55 mb-7 font-semibold">
          Download Now
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-5">
          {STORES.map(({ src, alt, href }) => (
            <a
              key={alt}
              href={href}
              aria-label={alt}
              className="inline-flex items-center justify-center transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-xl"
              target="_blank"
              rel="noopener noreferrer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={alt}
                className="h-14 sm:h-16 w-auto object-contain"
              />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
