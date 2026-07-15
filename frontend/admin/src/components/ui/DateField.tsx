'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  addDays, addMonths, endOfMonth, endOfWeek, format, isAfter, isBefore,
  isSameDay, isSameMonth, parseISO, startOfDay, startOfMonth, startOfWeek,
} from 'date-fns';
import { cn } from '@/lib/utils';

/**
 * DateField — a fully-styled, dark-theme date picker that REPLACES the
 * browser-native <input type="date">.
 *
 * Why this exists: the native picker's calendar popup is rendered by the
 * browser and is NOT stylable via CSS, so adjacent-month "outside" days
 * render in the same weight as the current month and visually blend
 * together ("dates mix ho rahi hai"). This component renders the grid
 * ourselves so outside-month days are clearly muted and the current
 * month / selected day / today read cleanly on the admin dark theme.
 *
 * Drop-in contract: value and onChange use the SAME 'YYYY-MM-DD' string
 * (or '') the native input emitted, so page state/query logic is unchanged.
 */

interface DateFieldProps {
  value: string;                 // 'YYYY-MM-DD' or ''
  onChange: (v: string) => void; // emits 'YYYY-MM-DD' or ''
  min?: string;                  // 'YYYY-MM-DD' lower bound (inclusive)
  max?: string;                  // 'YYYY-MM-DD' upper bound (inclusive)
  placeholder?: string;
  className?: string;            // applied to the trigger button
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function parse(v?: string): Date | null {
  if (!v) return null;
  try {
    const d = parseISO(v);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export default function DateField({
  value, onChange, min, max, placeholder = 'mm/dd/yyyy', className,
}: DateFieldProps) {
  const selected = parse(value);
  const minD = parse(min);
  const maxD = parse(max);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(selected || new Date());
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  // Portal the popup to <body> at a fixed position so a scrolling/overflow-
  // hidden ancestor (e.g. a modal with overflow-y-auto) can't clip the
  // calendar — the "calendar not fully visible" bug (client 2026-07-15).
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const POP_W = 256; // w-64
  const POP_H = 320; // approx popup height

  const place = () => {
    const b = btnRef.current?.getBoundingClientRect();
    if (!b) return;
    // Prefer below the trigger; flip above if it would overflow the viewport.
    const below = b.bottom + 4;
    const top = below + POP_H > window.innerHeight && b.top - POP_H - 4 > 0
      ? b.top - POP_H - 4
      : below;
    // Right-align to the trigger, clamped into the viewport.
    let left = b.right - POP_W;
    if (left < 8) left = 8;
    if (left + POP_W > window.innerWidth - 8) left = window.innerWidth - 8 - POP_W;
    setPos({ top, left });
  };

  // Re-sync the visible month when the value changes from outside.
  useEffect(() => {
    if (selected) setViewMonth(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Position on open + keep it pinned while the page scrolls/resizes.
  useEffect(() => {
    if (!open) return;
    place();
    const onMove = () => place();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on outside click (trigger AND the portalled popup are "inside").
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 0 });
    const gridEnd = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 0 });
    const out: Date[] = [];
    let d = gridStart;
    while (d <= gridEnd) {
      out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, [viewMonth]);

  const isDisabled = (d: Date) =>
    Boolean(
      (minD && isBefore(startOfDay(d), startOfDay(minD))) ||
      (maxD && isAfter(startOfDay(d), startOfDay(maxD))),
    );

  const pick = (d: Date) => {
    if (isDisabled(d)) return;
    onChange(format(d, 'yyyy-MM-dd'));
    setOpen(false);
  };

  const today = new Date();

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md inline-flex items-center gap-2 min-w-[130px]',
          className,
        )}
      >
        <span className={selected ? 'text-text-primary' : 'text-text-tertiary'}>
          {selected ? format(selected, 'MM/dd/yyyy') : placeholder}
        </span>
        <CalendarIcon size={13} className="text-text-tertiary ml-auto" />
      </button>

      {open && pos && createPortal(
        <div
          ref={popRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: POP_W }}
          className="z-[9999] p-3 rounded-lg border border-border-primary bg-bg-secondary shadow-modal">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, -1))}
              className="p-1 rounded hover:bg-bg-hover text-text-secondary"
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-semibold text-text-primary">
              {format(viewMonth, 'MMMM yyyy')}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              className="p-1 rounded hover:bg-bg-hover text-text-secondary"
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-[10px] font-medium text-text-tertiary py-1">
                {w}
              </div>
            ))}
          </div>

          {/* Day grid — show ONLY the current month's days. Leading/trailing
              cells from the adjacent months are rendered blank so the calendar
              never shows previous- or next-month dates (client 2026-07-06). */}
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((d, i) => {
              if (!isSameMonth(d, viewMonth)) {
                return <div key={i} className="h-7 w-7" aria-hidden />;
              }
              const sel = selected != null && isSameDay(d, selected);
              const isToday = isSameDay(d, today);
              const disabled = isDisabled(d);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(d)}
                  className={cn(
                    'h-7 w-7 rounded text-[11px] tabular-nums flex items-center justify-center transition-colors',
                    sel
                      ? 'bg-buy text-white font-semibold'
                      : 'text-text-secondary hover:bg-bg-hover',
                    isToday && !sel ? 'ring-1 ring-buy/50' : '',
                    disabled ? 'opacity-30 cursor-not-allowed hover:bg-transparent' : '',
                  )}
                >
                  {format(d, 'd')}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-primary">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className="text-[11px] text-text-tertiary hover:text-text-primary"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => { setViewMonth(today); if (!isDisabled(today)) pick(today); }}
              className="text-[11px] text-buy hover:underline"
            >
              Today
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
