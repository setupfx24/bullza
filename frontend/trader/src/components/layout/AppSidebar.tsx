'use client';

import { BrandWordmark } from '@/components/layout/BrandWordmark';

import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useShellStore } from '@/stores/shellStore';
import { usePlatformStatusStore } from '@/stores/platformStatusStore';
import { cn } from '@/lib/utils';
import {
  X,
  FileText,
  HelpCircle,
  Headphones,
  ChevronDown,
} from 'lucide-react';
import {
  NAV_ITEMS,
  isGroup,
  type LeafItem,
  type NavEntry,
} from './navItems';

export default function AppSidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useShellStore();
  const pammEnabled = usePlatformStatusStore((s) => s.pamm_enabled);
  const mamEnabled = usePlatformStatusStore((s) => s.mam_enabled);

  // Hide PAMM (/pamm) and/or MAMM-Copy-Trading (/social) when the admin
  // has switched the product off for customers.
  const navItems = useMemo(
    () => NAV_ITEMS.filter((e) => {
      const href = (e as LeafItem).href;
      if (href === '/pamm' && !pammEnabled) return false;
      if (href === '/social' && !mamEnabled) return false;
      return true;
    }),
    [pammEnabled, mamEnabled],
  );

  // Auto-expand the group whose children include the current route, but let
  // the user collapse/expand manually after that.
  const initiallyOpenGroups = useMemo(() => {
    const open = new Set<string>();
    for (const e of NAV_ITEMS) {
      if (isGroup(e) && e.children.some((c) => pathname.startsWith(c.href))) {
        open.add(e.key);
      }
    }
    return open;
  }, [pathname]);
  const [openGroups, setOpenGroups] = useState<Set<string>>(initiallyOpenGroups);
  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-bg-base/75 z-[65] lg:hidden"
          aria-hidden
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          /* z-[70] above MobileBottomNav (z-[60]) so drawer links receive taps on small screens */
          'fixed top-0 left-0 z-[70] h-full w-[260px] flex flex-col overflow-hidden transition-transform duration-200',
          'bg-bg-base border-r border-border-primary',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3 gap-2">
          {/* Brand mark — tenant logo image when configured, styled
              wordmark text otherwise (see BrandWordmark). */}
          <BrandWordmark href="/dashboard" className="flex items-center min-w-0" />
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-text-secondary hover:text-text-primary p-1.5 rounded-lg hover:bg-bg-hover transition-colors shrink-0"
            aria-label="Close menu"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-2 px-2 sidebar-scroll">
          {navItems.map((entry) => {
            if (isGroup(entry)) {
              const expanded = openGroups.has(entry.key);
              const groupActive = entry.children.some((c) => pathname === c.href || pathname.startsWith(`${c.href}/`));
              return (
                <div key={entry.key} className="mb-0.5">
                  <button
                    type="button"
                    onClick={() => toggleGroup(entry.key)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors',
                      groupActive
                        ? 'bg-accent/10 text-text-primary border border-accent/22'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent',
                    )}
                  >
                    <entry.icon
                      size={17}
                      strokeWidth={1.85}
                      className={cn(
                        'shrink-0 transition-[filter,color] sidebar-icon-glow text-[#E85D3D]',
                        groupActive
                          ? 'drop-shadow-[0_0_8px_rgba(232, 93, 61,0.55)]'
                          : 'drop-shadow-[0_0_6px_rgba(232, 93, 61,0.35)]',
                      )}
                    />
                    <span className="truncate flex-1 text-left">{entry.label}</span>
                    <ChevronDown
                      size={14}
                      className={cn('shrink-0 transition-transform text-text-tertiary', expanded && 'rotate-180')}
                    />
                  </button>
                  {expanded && (
                    <div className="ml-3 border-l border-border-primary pl-1 mt-0.5 mb-1">
                      {entry.children.map((child) => {
                        const isActive = pathname === child.href || pathname.startsWith(`${child.href}/`);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => {
                              if (window.innerWidth < 1024) setSidebarOpen(false);
                            }}
                            className={cn(
                              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12.5px] font-medium transition-colors mb-0.5',
                              isActive
                                ? 'bg-accent/10 text-text-primary border border-accent/22'
                                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent',
                            )}
                          >
                            <child.icon size={14} strokeWidth={1.85} className="shrink-0 text-[#E85D3D]/85" />
                            <span className="truncate">{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const itemPath = entry.href.split('?')[0];
            const isActive = pathname === itemPath || pathname.startsWith(`${itemPath}/`);
            return (
              <Link
                key={entry.href}
                href={entry.href}
                onClick={() => {
                  if (window.innerWidth < 1024) setSidebarOpen(false);
                }}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors mb-0.5',
                  isActive
                    ? 'bg-accent/10 text-text-primary border border-accent/22'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent',
                )}
              >
                <entry.icon
                  size={17}
                  strokeWidth={1.85}
                  className={cn(
                    'shrink-0 transition-[filter,color] sidebar-icon-glow text-[#E85D3D]',
                    isActive
                      ? 'drop-shadow-[0_0_8px_rgba(232, 93, 61,0.55)]'
                      : 'drop-shadow-[0_0_6px_rgba(232, 93, 61,0.35)]',
                  )}
                />
                <span className="truncate">{entry.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-4 pt-2 space-y-2.5 border-t border-border-primary bg-bg-base">
          <Link
            href="/terms"
            className="flex items-center gap-2 rounded-lg border border-border-primary bg-bg-secondary px-3 py-2.5 text-xs text-text-secondary hover:text-text-primary hover:border-border-accent transition-colors"
          >
            <FileText size={14} className="text-accent shrink-0 opacity-90" />
            <span>Terms & Conditions</span>
          </Link>

          <div className="rounded-xl p-3.5 border border-border-primary bg-card-nested">
            <div className="flex items-center gap-1.5 mb-1">
              <HelpCircle size={14} className="text-accent shrink-0" />
              <span className="text-xs font-semibold text-text-primary">Need Help?</span>
            </div>
            <p className="text-[10px] text-text-tertiary mb-3 leading-relaxed">Contact our 24/7 support team</p>
            <Link
              href="/support"
              className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-border-primary text-xs text-text-secondary hover:text-text-primary hover:border-accent/35 hover:bg-accent/5 transition-colors"
            >
              <Headphones size={12} className="text-accent/80" />
              <span>Get Support</span>
            </Link>
          </div>

        </div>
      </aside>
    </>
  );
}
