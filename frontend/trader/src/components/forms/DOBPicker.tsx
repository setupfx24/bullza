'use client';

/**
 * DOBPicker — calendar input for date-of-birth on the profile completion
 * gate. Uses react-day-picker so we can hide adjacent-month days (the
 * native <input type="date"> shows greyed leading/trailing days and the
 * browser owns that, so client-asked "only this month's days" is only
 * possible with a custom picker).
 *
 * Constraints baked into the picker:
 *   • max = today − 18 years (matches the 18+ submit-time guard)
 *   • min = today − 120 years
 *   • default month opens at ~25 years ago if no value set
 *   • year + month dropdowns so the user doesn't click prev-month 30×
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { Calendar } from 'lucide-react';

interface DOBPickerProps {
  value: string;                       // YYYY-MM-DD (empty if unset)
  onChange: (iso: string) => void;
  minAgeYears?: number;
  disabled?: boolean;
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIso(s: string): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

export default function DOBPicker({
  value,
  onChange,
  minAgeYears = 18,
  disabled = false,
}: DOBPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = parseIso(value);

  const { minDate, maxDate, fallbackMonth } = useMemo(() => {
    const today = new Date();
    const max = new Date(today.getFullYear() - minAgeYears, today.getMonth(), today.getDate());
    const min = new Date(today.getFullYear() - 120, 0, 1);
    const fallback = new Date(today.getFullYear() - 25, today.getMonth(), 1);
    return { minDate: min, maxDate: max, fallbackMonth: fallback };
  }, [minAgeYears]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const display = selected
    ? selected.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  return (
    <div ref={ref} className="relative">
      <Calendar
        size={14}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
        aria-hidden
      />
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border-primary bg-bg-secondary text-text-primary outline-none focus:border-[#55a630]/50 text-sm text-left disabled:opacity-60"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {display || <span className="text-text-tertiary">Select date</span>}
      </button>
      {open && !disabled && (
        <div
          className="dob-popover absolute z-50 mt-1 left-0 rounded-xl border border-border-primary bg-bg-secondary shadow-2xl p-2"
          role="dialog"
        >
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={(d) => {
              if (d) {
                onChange(toIso(d));
                setOpen(false);
              }
            }}
            showOutsideDays={false}
            captionLayout="dropdown"
            startMonth={minDate}
            endMonth={maxDate}
            defaultMonth={selected || fallbackMonth}
            disabled={{ after: maxDate, before: minDate }}
          />
        </div>
      )}
    </div>
  );
}
