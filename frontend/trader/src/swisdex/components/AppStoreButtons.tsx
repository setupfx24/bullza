'use client';

import { Apple, Play } from 'lucide-react';

/**
 * Twin "Download on the App Store" / "Android App" pill buttons.
 * Sits just above the TrustBadges row on every public landing page.
 * Currently the hrefs are placeholders — swap them when the iOS and
 * Android builds land in their respective stores.
 */
const STORES = [
  { Icon: Apple, top: 'Download on the', bottom: 'App Store',  href: '#' },
  { Icon: Play,  top: 'Download our',    bottom: 'Android App', href: '#' },
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
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
        {STORES.map(({ Icon, top, bottom, href }) => (
          <a
            key={bottom}
            href={href}
            className="inline-flex items-center gap-3 rounded-2xl px-5 py-2.5 bg-black/85 hover:bg-black border border-foreground/20 hover:border-primary/50 transition-colors min-w-[200px]"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon className="size-8 shrink-0 text-foreground" aria-hidden />
            <div className="flex flex-col leading-tight text-left">
              <span className="text-[10px] uppercase tracking-[0.16em] text-foreground/65">
                {top}
              </span>
              <span className="font-display text-lg tracking-tight text-foreground">
                {bottom}
              </span>
            </div>
          </a>
        ))}
        </div>
      </div>
    </section>
  );
}
