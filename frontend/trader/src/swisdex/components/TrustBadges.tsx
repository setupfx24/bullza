'use client';

import {
  Bitcoin,
  Wallet,
  CandlestickChart,
  Smartphone,
  Apple,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

/**
 * "Trusted By" badge row — sits just above the footer on every public
 * landing page. Icons are placeholders; drop branded SVG/PNG logos at
 * /public/images/badges/<slug>.svg and swap the Icon for an <img>.
 */
type Badge = { Icon: LucideIcon; label: string; sub: string };

const BADGES: Badge[] = [
  { Icon: Bitcoin,          label: 'Crypto Payments', sub: 'BTC · ETH · USDT' },
  { Icon: Wallet,           label: 'NOWPayments',     sub: 'Secure Gateway'   },
  { Icon: CandlestickChart, label: 'TradingView',     sub: 'Live Charts'      },
  { Icon: Smartphone,       label: 'Google Play',     sub: 'Android App'      },
  { Icon: Apple,            label: 'App Store',       sub: 'iOS App'          },
  { Icon: ShieldCheck,      label: 'SSL Secured',     sub: '256-bit Encryption' },
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
        <div className="flex flex-wrap items-stretch justify-center gap-3 sm:gap-4">
          {BADGES.map(({ Icon, label, sub }) => (
            <div
              key={label}
              className="liquid-glass rounded-2xl px-4 py-3 flex items-center gap-3 min-w-[180px] flex-1 max-w-[220px]"
            >
              <Icon className="size-6 text-primary shrink-0" aria-hidden />
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
