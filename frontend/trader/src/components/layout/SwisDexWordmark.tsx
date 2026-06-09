import Link from 'next/link';
import { cn } from '@/lib/utils';

type Props = {
  href?: string;
  className?: string;
  /** Applied to the wordmark text (e.g. responsive sizes). */
  textClassName?: string;
  /** Default: sidebar / header. Rail: tiny terminal left bar. */
  variant?: 'default' | 'rail';
};

/**
 * Text wordmark for dashboard chrome (replaces raster logo).
 */
export function SwisDexWordmark({
  href = '/dashboard',
  className,
  textClassName,
  variant = 'default',
}: Props) {
  if (variant === 'rail') {
    return (
      <Link
        href={href}
        title="Trading home"
        className={cn(
          'flex items-center justify-center rounded-md hover:bg-bg-hover w-9 h-9 transition-colors',
          'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[#55a630]',
          className,
        )}
      >
        {/* Rail logo: image in dark, S monogram in light — the raster
            logo has a dark background baked in that looks awkward on
            the light theme's white surface. */}
        <img src="/images/swisdex_png5.png" alt="SwisDex" className="w-7 h-7 object-contain hidden dark:block" />
        <span
          aria-hidden="true"
          className="dark:hidden inline-flex items-center justify-center font-display font-bold text-base leading-none"
          style={{ color: '#55a630' }}
        >
          S
        </span>
      </Link>
    );
  }

  // Theme-aware mark: raster image in dark mode (image already carries
  // its own dark background + "SwisDex" lettering), and a CSS-only
  // wordmark in light mode so we don't dump an embedded dark rectangle
  // onto a white surface.
  void textClassName;
  const mark = (
    <span className={cn('inline-flex items-center select-none', className)}>
      <img
        src="/images/swisdex_png5.png"
        alt="SwisDex"
        className="h-9 sm:h-10 w-auto object-contain shrink-0 hidden dark:block"
      />
      <span
        aria-hidden="true"
        className="dark:hidden font-display font-bold tracking-tight text-2xl sm:text-[26px] leading-none"
      >
        <span style={{ color: '#0a0a0a' }}>Swis</span>
        <span style={{ color: '#55a630' }}>dex</span>
      </span>
    </span>
  );

  return (
    <Link
      href={href}
      className={cn(
        'min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#55a630]/60 focus-visible:rounded-md',
        className,
      )}
    >
      {mark}
    </Link>
  );
}
