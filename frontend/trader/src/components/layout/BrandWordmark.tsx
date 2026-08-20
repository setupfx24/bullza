import Link from 'next/link';
import { cn } from '@/lib/utils';
import { BRAND_LOGO, BRAND_NAME } from '@/lib/brand';

type Props = {
  href?: string;
  className?: string;
  /** Applied to the wordmark text (e.g. responsive sizes). */
  textClassName?: string;
  /** Default: sidebar / header. Rail: tiny terminal left bar. */
  variant?: 'default' | 'rail';
};

/**
 * Brand mark for dashboard chrome. Renders the tenant's logo image when
 * NEXT_PUBLIC_BRAND_LOGO is configured, otherwise a styled text wordmark
 * of BRAND_NAME — so an unconfigured white-label build never ships
 * another brand's artwork.
 */
export function BrandWordmark({
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
          'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[#E85D3D]',
          className,
        )}
      >
        {BRAND_LOGO ? (
          <img src={BRAND_LOGO} alt={BRAND_NAME} className="w-7 h-7 object-contain" />
        ) : (
          <span className="text-sm font-black tracking-tight text-text-primary select-none">
            {BRAND_NAME.slice(0, 2).toUpperCase()}
          </span>
        )}
      </Link>
    );
  }

  const mark = BRAND_LOGO ? (
    <span className={cn('inline-flex items-center select-none', className)}>
      <img
        src={BRAND_LOGO}
        alt={BRAND_NAME}
        className="h-9 sm:h-10 w-auto object-contain shrink-0"
      />
    </span>
  ) : (
    <span
      className={cn(
        'inline-flex items-center select-none font-black tracking-tight text-lg text-text-primary',
        textClassName,
        className,
      )}
    >
      {BRAND_NAME}
    </span>
  );

  return (
    <Link
      href={href}
      className={cn(
        'min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D3D]/60 focus-visible:rounded-md',
        className,
      )}
    >
      {mark}
    </Link>
  );
}
