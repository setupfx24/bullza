'use client';

/**
 * Admin notification bell — pulsing badge in the top bar that shows the
 * count of admin-actionable items (pending deposits, withdrawals, KYC
 * submissions, support tickets, dual-approval requests, recent sign-ups).
 *
 * Implementation notes:
 *  • Dropdown is rendered via a React portal at document.body level.
 *    The admin top bar uses `backdrop-filter: blur(...)` (`.glass`),
 *    which creates a containing block for absolutely-positioned
 *    descendants AND clips them to its 56px bounding box. Without the
 *    portal, only the first row of the dropdown was visible (this was
 *    the "notification not working" symptom).
 *  • All categories are always shown — zero-count items are muted but
 *    visible — so the bell doubles as a status board.
 *  • When a critical/normal count transitions from 0 → positive, we
 *    fire a toast so admins get *active* notification rather than
 *    relying on them to hover the bell. Dedup on poll cycle so the
 *    same item doesn't repeat.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  Bell, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, IdCard,
  MessageCircle, ShieldCheck, UserPlus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';

type Severity = 'critical' | 'normal' | 'info';

interface Item {
  kind: string;
  count: number;
  label: string;
  link: string;
  severity: Severity;
}

interface Summary {
  total: number;
  items: Item[];
}

const POLL_INTERVAL_MS = 30_000;
const DROPDOWN_WIDTH_PX = 320;
const DROPDOWN_OFFSET_PX = 8;

function iconFor(kind: string) {
  switch (kind) {
    case 'deposits':    return ArrowDownToLine;
    case 'withdrawals': return ArrowUpFromLine;
    case 'kyc':         return IdCard;
    case 'tickets':     return MessageCircle;
    case 'approvals':   return ShieldCheck;
    case 'new_users':   return UserPlus;
    default:            return AlertTriangle;
  }
}

function severityIconColor(s: Severity, count: number) {
  if (count === 0) return 'text-text-tertiary';
  switch (s) {
    case 'critical': return 'text-danger';
    case 'normal':   return 'text-warning';
    case 'info':     return 'text-text-tertiary';
  }
}

function countBadgeClass(s: Severity, count: number) {
  if (count === 0) return 'bg-bg-tertiary text-text-tertiary';
  switch (s) {
    case 'critical': return 'bg-danger/20 text-danger';
    case 'normal':   return 'bg-warning/20 text-warning';
    case 'info':     return 'bg-bg-tertiary text-text-secondary';
  }
}

export default function AdminNotificationBell() {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const previousCounts = useRef<Record<string, number> | null>(null);

  // Portals need a DOM target — defer rendering until after mount.
  useEffect(() => { setMounted(true); }, []);

  // Poll the summary endpoint on mount + every 30s.
  // On each successful poll, compare counts to the previous snapshot and
  // toast when a critical/normal item transitions from 0 → positive (i.e.
  // a new actionable item arrived since last check). Skip the very first
  // poll so admins don't get a torrent of toasts on page load.
  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const res = await adminApi.get<Summary>('/notifications/summary');
        if (cancelled) return;
        setSummary(res);

        const prev = previousCounts.current;
        if (prev) {
          for (const item of res.items || []) {
            if (item.severity === 'info') continue;
            const before = prev[item.kind] ?? 0;
            if (item.count > before) {
              const delta = item.count - before;
              const Icon = iconFor(item.kind);
              toast(
                (t) => (
                  <button
                    type="button"
                    onClick={() => { router.push(item.link); toast.dismiss(t.id); }}
                    className="flex items-center gap-2.5 text-left"
                  >
                    <Icon size={16} className={severityIconColor(item.severity, item.count)} />
                    <span className="text-xs">
                      <span className="font-semibold">
                        {delta === 1 ? 'New' : `${delta} new`}
                      </span>{' '}
                      {item.label.toLowerCase()} — click to view
                    </span>
                  </button>
                ),
                { duration: 6000, icon: undefined },
              );
            }
          }
        }
        const next: Record<string, number> = {};
        for (const item of res.items || []) next[item.kind] = item.count;
        previousCounts.current = next;
      } catch {
        // Silent — bell just stops updating; don't spam toasts on
        // transient errors (e.g. brief admin-api restart).
      }
    };
    void fetchOnce();
    const t = setInterval(fetchOnce, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(t); };
  }, [router]);

  // Compute portal coordinates from the bell button's bounding rect.
  // Re-runs on open + window resize so the dropdown follows layout changes.
  useLayoutEffect(() => {
    if (!open) return;
    const recalc = () => {
      const btn = buttonRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      setCoords({ top: r.bottom + DROPDOWN_OFFSET_PX, right: window.innerWidth - r.right });
    };
    recalc();
    window.addEventListener('resize', recalc);
    window.addEventListener('scroll', recalc, true);
    return () => {
      window.removeEventListener('resize', recalc);
      window.removeEventListener('scroll', recalc, true);
    };
  }, [open]);

  // Click-away (button OR dropdown counts as inside).
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const total = summary?.total ?? 0;
  // Show every item, even those with count 0. The bell doubles as a status
  // board — admins want to see at a glance that "yes, KYC queue is empty
  // right now" rather than an empty dropdown they can't tell apart from a
  // broken endpoint.
  const items = summary?.items ?? [];

  const dropdown = open && coords && mounted ? createPortal(
    <div
      ref={dropdownRef}
      className="fixed rounded-xl border border-border-primary bg-bg-secondary shadow-2xl overflow-hidden"
      style={{
        top: coords.top,
        right: coords.right,
        width: DROPDOWN_WIDTH_PX,
        zIndex: 9999, // above everything; the top bar's backdrop-filter caps z-index inside its containing block
      }}
    >
      <div className="px-3.5 py-2.5 border-b border-border-primary flex items-center justify-between">
        <span className="text-xs font-semibold text-text-primary">Notifications</span>
        <span className="text-[10px] text-text-tertiary">
          {total === 0 ? 'All clear' : `${total} item${total === 1 ? '' : 's'} pending`}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="py-8 text-center text-xs text-text-tertiary">
          {summary === null
            ? 'Loading…'
            : 'Notification feed unavailable.'}
        </div>
      ) : (
        <ul className="max-h-[420px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {items.map((item) => {
            const Icon = iconFor(item.kind);
            const muted = item.count === 0;
            return (
              <li key={item.kind}>
                <button
                  type="button"
                  onClick={() => { setOpen(false); router.push(item.link); }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-fast border-b border-border-primary/30 last:border-b-0',
                    'hover:bg-bg-hover',
                    muted && 'opacity-60',
                  )}
                >
                  <Icon size={15} className={cn('shrink-0', severityIconColor(item.severity, item.count))} />
                  <span className="flex-1 text-xs text-text-primary truncate">{item.label}</span>
                  <span
                    className={cn(
                      'inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-md text-[10px] font-bold tabular-nums',
                      countBadgeClass(item.severity, item.count),
                    )}
                  >
                    {item.count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="px-3.5 py-2 border-t border-border-primary text-[10px] text-text-tertiary text-center">
        Auto-refreshes every 30s
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative flex items-center justify-center w-9 h-9 rounded-lg transition-fast',
          'bg-bg-primary/40 border border-border-primary/30 text-text-secondary hover:text-text-primary hover:bg-bg-hover',
          // Subtle red glow on the button itself when items pending — nudges
          // peripheral vision towards the bell even when the admin's eyes
          // aren't on the top bar.
          total > 0 && 'border-danger/40 shadow-[0_0_0_1px_rgba(239,68,68,0.35)]',
        )}
        title="Notifications"
        aria-label={`Notifications — ${total} pending items`}
        aria-expanded={open}
      >
        <Bell size={15} className={total > 0 ? 'notif-bell-ring text-danger' : ''} />
        {total > 0 && (
          <span
            className={cn(
              'absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold',
              'flex items-center justify-center bg-danger text-white notif-badge-blink',
            )}
          >
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>
      {dropdown}
    </>
  );
}
