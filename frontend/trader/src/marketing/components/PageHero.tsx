import Link from 'next/link';
import { clsx } from 'clsx';

/**
 * Standard hero for inner marketing pages (markets, products, services,
 * company, legal). The homepage keeps its own bespoke hero; every other
 * page uses this so inner pages open consistently.
 */
export function PageHero({
  kicker, title, lead, primary, secondary, children, className,
}: {
  kicker?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={clsx('relative overflow-hidden', className)}>
      {/* Soft accent bloom behind the headline — pure CSS, no image asset. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 55% at 50% 0%, var(--mk-accent-soft) 0%, transparent 70%)',
        }}
      />
      <div className="mk-container relative" style={{ paddingBlock: 'var(--mk-section-y)' }}>
        <div className="flex flex-col items-center text-center gap-5 mx-auto max-w-3xl">
          {kicker && <span className="mk-kicker">{kicker}</span>}
          <h1 className="mk-h1">{title}</h1>
          {lead && <p className="mk-lead">{lead}</p>}
          {(primary || secondary) && (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {primary && (
                <Link href={primary.href} className="mk-btn mk-btn--primary">
                  {primary.label}
                </Link>
              )}
              {secondary && (
                <Link href={secondary.href} className="mk-btn mk-btn--ghost">
                  {secondary.label}
                </Link>
              )}
            </div>
          )}
          {children}
        </div>
      </div>
    </header>
  );
}
