'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { clsx } from 'clsx';

export interface FaqItem { q: string; a: React.ReactNode }

/**
 * Accessible FAQ accordion — native button headers, one panel open at a
 * time. Used on the homepage and the standalone /faq page.
 */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={item.q}
            className="overflow-hidden"
            style={{
              background: 'var(--mk-surface)',
              border: `1px solid ${isOpen ? 'var(--mk-accent-line)' : 'var(--mk-line)'}`,
              borderRadius: 'var(--mk-radius)',
              transition: 'border-color var(--mk-transition)',
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="text-[15px] font-bold" style={{ color: 'var(--mk-text)' }}>
                {item.q}
              </span>
              <Plus
                size={18}
                className={clsx('shrink-0 transition-transform duration-200', isOpen && 'rotate-45')}
                style={{ color: 'var(--mk-accent)' }}
              />
            </button>
            {isOpen && (
              <div className="px-5 pb-5 -mt-1">
                <div className="mk-body">{item.a}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
