'use client';

/**
 * "Trusted By" badge row — sits just above the footer on every public
 * landing page. Each card has an empty circular placeholder on top
 * (drop a logo image at /public/images/badges/<slug>.png and swap it
 * in via the `logo` field below) plus a label + caption underneath.
 */
type Badge = { label: string; sub: string; logo?: string };

const BADGES: Badge[] = [
  { label: 'Crypto Payments', sub: 'BTC · ETH · USDT',    logo: '/images/bit_icon.png' },
  { label: 'NOW Payments',    sub: 'Secure Gateway',      logo: '/images/b2.png' },
  { label: 'Trading View',    sub: 'Live Charts',         logo: '/images/b3.png' },
  { label: 'SSL Secured',     sub: '256-bit Encryption',  logo: '/images/b4.png' },
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
        <div className="flex flex-wrap items-stretch justify-center gap-1 sm:gap-2">
          {BADGES.map(({ label, sub, logo }) => (
            <div
              key={label}
              className="px-1.5 py-4 flex flex-col items-center text-center gap-3 w-[130px] sm:w-[140px]"
            >
              {logo && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={logo}
                  alt=""
                  className="size-24 object-contain"
                  aria-hidden
                />
              )}
              <div className="flex flex-col leading-tight">
                <span className="font-display uppercase text-xs tracking-tight text-foreground">
                  {label}
                </span>
                <span className="text-[10px] text-foreground/55 mt-0.5">{sub}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
