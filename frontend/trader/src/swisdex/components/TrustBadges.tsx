'use client';

/**
 * "Trusted By" badge row — sits just above the footer on every public
 * landing page. Each card has an empty circular placeholder on top
 * (drop a logo image at /public/images/badges/<slug>.png and swap it
 * in via the `logo` field below) plus a label + caption underneath.
 */
type Badge = { label: string; sub: string; logo?: string };

const BADGES: Badge[] = [
  { label: 'Crypto Payments', sub: 'BTC · ETH · USDT',    logo: '/images/badges1.png' },
  { label: 'NOWPayments',     sub: 'Secure Gateway',      logo: '/images/badges2.png' },
  { label: 'TradingView',     sub: 'Live Charts',         logo: '/images/badges3.png' },
  { label: 'Google Play',     sub: 'Android App',         logo: '/images/badges4.png' },
  { label: 'App Store',       sub: 'iOS App',             logo: '/images/badges5.png' },
  { label: 'SSL Secured',     sub: '256-bit Encryption',  logo: '/images/badges6.png' },
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
              {/* Logo placeholder — blank circle until a real logo PNG is
                  dropped in /public/images/badges/. When you have one,
                  set `logo: '/images/badges/<file>.png'` in BADGES above. */}
              <div
                className="size-24 rounded-full bg-foreground/[0.06] flex items-center justify-center overflow-hidden"
                style={{ border: '1px solid hsl(99 55% 42% / 0.35)' }}
                aria-hidden
              >
                {logo && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={logo} alt="" className="w-full h-full object-contain" />
                )}
              </div>
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
