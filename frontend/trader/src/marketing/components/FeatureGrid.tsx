import { clsx } from 'clsx';
import type { LucideIcon } from 'lucide-react';

export interface FeatureItem {
  /** Any lucide-react icon (they are forwardRef components, so use the
   *  library's own type rather than a hand-rolled ComponentType — the
   *  narrower shape rejected every real icon). */
  icon?: LucideIcon;
  title: string;
  body: React.ReactNode;
}

/**
 * Icon + title + copy cards. The workhorse block for benefit and
 * "what you get" sections across the marketing site.
 */
export function FeatureGrid({
  items, columns = 3, className,
}: {
  items: FeatureItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const cols = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
  }[columns];

  return (
    <div className={clsx('grid grid-cols-1 gap-5', cols, className)}>
      {items.map(({ icon: Icon, title, body }) => (
        <article key={title} className="mk-card mk-card--hover flex flex-col gap-3">
          {Icon && (
            <span
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
              style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
            >
              <Icon size={20} />
            </span>
          )}
          <h3 className="mk-h3">{title}</h3>
          <p className="mk-body">{body}</p>
        </article>
      ))}
    </div>
  );
}
