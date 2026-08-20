'use client';

/**
 * Twin Apple / Google Play store badge images — public landing page CTA
 * row sitting just above TrustBadges. The badge artwork (with its store
 * wordmark baked in) lives at /public/images/app_store.png and
 * /public/images/google_play.png. Replace the hrefs with real store
 * links when the apps ship.
 */
const STORES = [
  { alt: 'Download on the App Store', src: '/images/app_store.png',  href: '#' },
  { alt: 'Get it on Google Play',     src: '/images/google_play.png', href: '#' },
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
        <p className="text-center text-[11px] uppercase tracking-[0.24em] text-foreground/55 mb-7 font-semibold">
          Download Now
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {STORES.map(({ alt, src, href }) => (
            <a
              key={src}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block transition-transform hover:scale-[1.03]"
              aria-label={alt}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={alt}
                className="h-14 sm:h-16 w-auto object-contain"
                loading="lazy"
                decoding="async"
              />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
