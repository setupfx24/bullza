'use client';

/**
 * Admin notification bell — pulsing badge in the top bar that shows the
 * count of admin-actionable items (pending deposits, withdrawals, KYC
 * submissions, support tickets, dual-approval requests, recent sign-ups).
 *
 * Polls /admin/notifications/summary every 30s. Each row in the dropdown
 * is a deep-link into the relevant section so the admin can jump straight
 * from "you have 3 pending withdrawals" to the withdrawals page.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, IdCard, MessageCircle, ShieldCheck, UserPlus } from 'lucide-react';
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

/** Icon per kind. Falls back to AlertTriangle for unknown kinds — adding a
 *  new server-side category will still render with a sensible default. */
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

function severityColor(s: Severity) {
  switch (s) {
    case 'critical': return 'text-danger';
    case 'normal':   return 'text-warning';
    case 'info':     return 'text-text-tertiary';
  }
}

export default function AdminNotificationBell() {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const res = await adminApi.get<Summary>('/notifications/summary');
        if (!cancelled) setSummary(res);
      } catch {
        // Silent — bell just stops updating; don't spam toasts on transient errors.
      }
    };
    void fetchOnce();
    const t = setInterval(fetchOnce, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // Click-away to close the dropdown.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const total = summary?.total ?? 0;
  const visibleItems = (summary?.items ?? []).filter((i) => i.count > 0 || i.severity !== 'info');

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative flex items-center justify-center w-9 h-9 rounded-lg transition-fast',
          'bg-bg-primary/40 border border-border-primary/30 text-text-secondary hover:text-text-primary hover:bg-bg-hover',
        )}
        title="Notifications"
        aria-label={`Notifications — ${total} pending items`}
      >
        <Bell size={15} />
        {total > 0 && (
          <span
            className={cn(
              'absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold',
              'flex items-center justify-center bg-danger text-white',
              total > 0 && 'animate-pulse',
            )}
          >
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 w-[320px] rounded-xl border border-border-primary bg-bg-secondary shadow-2xl overflow-hidden z-50"
        >
          <div className="px-3.5 py-2.5 border-b border-border-primary flex items-center justify-between">
            <span className="text-xs font-semibold text-text-primary">Notifications</span>
            <span className="text-[10px] text-text-tertiary">
              {total === 0 ? 'All clear' : `${total} item${total === 1 ? '' : 's'} pending`}
            </span>
          </div>
          {visibleItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-tertiary">
              Nothing to act on right now.
            </div>
          ) : (
            <ul className="max-h-[420px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              {visibleItems.map((item) => {
                const Icon = iconFor(item.kind);
                const muted = item.count === 0;
                return (
                  <li key={item.kind}>
                    <button
                      type="button"
                      onClick={() => { setOpen(false); router.push(item.link); }}
                      className={cn(
                        'w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-fast',
                        'hover:bg-bg-hover',
                        muted && 'opacity-50',
                      )}
                    >
                      <Icon size={15} className={cn('shrink-0', severityColor(item.severity))} />
                      <span className="flex-1 text-xs text-text-primary truncate">{item.label}</span>
                      <span
                        className={cn(
                          'inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-md text-[10px] font-bold tabular-nums',
                          item.count === 0
                            ? 'bg-bg-tertiary text-text-tertiary'
                            : item.severity === 'critical'
                              ? 'bg-danger/15 text-danger'
                              : item.severity === 'normal'
                                ? 'bg-warning/15 text-warning'
                                : 'bg-bg-tertiary text-text-secondary',
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
        </div>
      )}
    </div>
  );
}
