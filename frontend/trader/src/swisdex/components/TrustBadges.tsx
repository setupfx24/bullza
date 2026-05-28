'use client';

/**
 * "Trusted By" badge row — sits just above the footer on every public
 * landing page. Each card has an empty circular placeholder on top
 * (drop a logo image at /public/images/badges/<slug>.png and swap it
 * in via the `logo` field below) plus a label + caption underneath.
 */
type Badge = { label?: string; sub?: string; logo: string };

const BADGES: Badge[] = [
  // Logo-only row — labels and sub captions intentionally omitted per
  // client request so all 10 badges fit on a single line.
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
];

export function TrustBadges() {
  return (
    <section
      aria-label="Trusted by partners"
      className="relative py-10 sm:py-14 border-t border-border"
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
          Trusted By
        </p>
        <div className="flex flex-nowrap items-center justify-center gap-1 sm:gap-2 overflow-x-auto -mx-[var(--gutter)] px-[var(--gutter)]">
          {BADGES.map(({ label, sub, logo }) => (
            <div
              key={logo}
              className="shrink-0 px-1 py-2 flex flex-col items-center text-center gap-2 w-[80px] sm:w-[100px] md:w-[110px]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logo}
                alt={label ?? ''}
                className="size-12 sm:size-16 md:size-20 object-contain"
                aria-hidden={!label}
              />
              {(label || sub) && (
                <div className="flex flex-col leading-tight">
                  {label && (
                    <span className="font-display uppercase text-xs tracking-tight text-foreground">
                      {label}
                    </span>
                  )}
                  {sub && (
                    <span className="text-[10px] text-foreground/55 mt-0.5">{sub}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
