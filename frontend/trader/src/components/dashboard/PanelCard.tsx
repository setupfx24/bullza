'use client';

import { clsx } from 'clsx';

/**
 * Dashboard panel — the shared card shell for the redesigned home.
 * Soft rounded corners, minimal border, subtle elevation; colors come
 * from the theme tokens so it renders correctly in dark AND light.
 */
export function PanelCard({
  title,
  action,
  children,
  className,
  padding = 'md',
}: {
  title?: string;
  /** Optional right-aligned header element (link, select, etc.). */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg' | 'none';
}) {
  const pad = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' }[padding];
  return (
    <div
      className={clsx('rounded-2xl', pad, className)}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-glass-bright)',
        boxShadow: '0 6px 24px rgba(0,0,0,0.05)',
      }}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 mb-4">
          {title && (
            <h2 className="text-sm font-bold tracking-tight text-text-primary">{title}</h2>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/** Small pill link used in card headers ("View all →" pattern). */
export function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  // Plain anchor styling wrapper — callers pass a Next <Link> as parent
  // where routing matters; this stays a styled span for flexibility.
  return (
    <a
      href={href}
      className="text-[11px] font-bold text-text-tertiary hover:text-text-primary transition-colors"
    >
      {children}
    </a>
  );
}
