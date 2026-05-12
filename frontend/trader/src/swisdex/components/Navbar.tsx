'use client';

import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from 'motion/react';
import { ArrowUpRight, Menu, X, ChevronDown } from 'lucide-react';
import { Button } from '../ui/Button';
import { LanguageSwitcher } from './LanguageSwitcher';
import { NAV_ITEMS, BRAND, SIGNUP_HREF, type NavItem } from '../data';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Desktop dropdown nav item.
 * The dropdown panel is rendered via createPortal to `document.body` so it
 * cannot be clipped by any ancestor's `overflow: hidden` (the navbar pill
 * uses liquid-glass which clips its children to keep the gradient border
 * inside the rounded shape).
 */
function DesktopNavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = pathname === item.href || item.children?.some((c) => c.href === pathname);

  useEffect(() => setMounted(true), []);

  // Position the portal panel under the trigger.
  useIsomorphicLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const measure = () => {
      const r = triggerRef.current!.getBoundingClientRect();
      setCoords({
        top:  r.bottom + 10,           // 10px gap below trigger
        left: r.left + r.width / 2,    // horizontally center to trigger
      });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  if (!item.children) {
    return (
      <Link
        href={item.href}
        className={`relative px-3.5 py-2 text-[15px] font-semibold transition-colors font-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-full ${
          active ? 'text-foreground' : 'text-foreground/75 hover:text-foreground'
        }`}
      >
        {item.label}
        {active && (
          <span
            aria-hidden
            className="absolute left-1/2 -translate-x-1/2 -bottom-0.5 h-1 w-1 rounded-full bg-primary"
          />
        )}
      </Link>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onMouseEnter={() => { cancelClose(); setOpen(true); }}
        onMouseLeave={scheduleClose}
        onFocus={() => { cancelClose(); setOpen(true); }}
        onClick={() => setOpen((v) => !v)}
        className={`relative inline-flex items-center gap-1 px-3.5 py-2 text-[15px] font-semibold transition-colors font-body rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          active ? 'text-foreground' : 'text-foreground/75 hover:text-foreground'
        }`}
      >
        {item.label}
        <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        {active && (
          <span
            aria-hidden
            className="absolute left-1/2 -translate-x-1/2 -bottom-0.5 h-1 w-1 rounded-full bg-primary"
          />
        )}
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={panelRef}
                role="menu"
                onMouseEnter={cancelClose}
                onMouseLeave={scheduleClose}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="swisdex-home fixed z-[200] min-w-[230px] liquid-glass-strong rounded-2xl p-2 [backdrop-filter:blur(28px)]"
                style={{
                  top: coords.top,
                  left: coords.left,
                  transform: 'translateX(-50%)',
                }}
              >
                {item.children!.map((c) => {
                  const isActive = pathname === c.href;
                  return (
                    <Link
                      key={c.href}
                      href={c.href}
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className={`block px-3.5 py-2.5 text-sm font-semibold rounded-xl font-body transition-colors ${
                        isActive
                          ? 'bg-primary/25 text-primary'
                          : 'text-foreground/80 hover:bg-foreground/5 hover:text-foreground'
                      }`}
                    >
                      {c.label}
                    </Link>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

/** Mobile nav row — children render as nested expandable list. */
function MobileNavRow({
  item,
  onSelect,
}: {
  item: NavItem;
  onSelect: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (!item.children) {
    return (
      <Link
        href={item.href}
        onClick={onSelect}
        className="font-display uppercase text-2xl tracking-tight text-foreground/85 hover:text-foreground py-2 block"
      >
        {item.label}
      </Link>
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="font-display uppercase text-2xl tracking-tight text-foreground/85 hover:text-foreground py-2 inline-flex items-center gap-2"
      >
        {item.label}
        <ChevronDown className={`size-5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden flex flex-col items-center gap-1 py-2"
          >
            {item.children.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                onClick={onSelect}
                className="font-body text-base text-foreground/70 hover:text-primary transition-colors py-1.5"
              >
                {c.label}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollY } = useScroll();
  const pathname = usePathname() ?? '/';

  useMotionValueEvent(scrollY, 'change', (v) => {
    setScrolled(v > 40);
  });

  return (
    <>
      <motion.header
        data-scrolled={scrolled}
        className={`fixed inset-x-0 z-50 px-4 transition-[top] duration-500 ${
          scrolled ? 'top-2' : 'top-4'
        }`}
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="relative mx-auto w-full max-w-[1440px] flex items-center justify-center gap-3">
          <nav
            className={`liquid-glass rounded-full w-full max-w-[1320px] px-2 py-2 flex items-center justify-between gap-3 transition-[backdrop-filter] ${
              scrolled ? '[backdrop-filter:blur(28px)]' : ''
            }`}
            aria-label="Primary"
          >
            <Link href="/" className="flex items-center gap-2 pl-3 group shrink-0" aria-label={`${BRAND.name} home`}>
              <img
                src={BRAND.logo}
                alt={BRAND.name}
                className="h-8 w-auto object-contain"
              />
            </Link>

            <div className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
              {NAV_ITEMS.map((item) => (
                <DesktopNavLink key={item.label} item={item} pathname={pathname} />
              ))}
            </div>

            <div className="hidden lg:flex items-center gap-2 shrink-0">
              <Button variant="hero" className="rounded-full px-4 py-1.5 text-sm h-auto" asChild>
                <Link href={SIGNUP_HREF}>
                  Get Started
                  <ArrowUpRight className="ml-1 size-4" />
                </Link>
              </Button>
            </div>

            <div className="lg:hidden flex items-center gap-2 mr-2">
              <button
                type="button"
                aria-label="Open menu"
                aria-expanded={open}
                className="size-9 rounded-full liquid-glass-strong flex items-center justify-center text-foreground"
                onClick={() => setOpen(true)}
              >
                <Menu className="size-4" />
              </button>
            </div>
          </nav>

          {/* Language switcher — sits OUTSIDE the navbar pill on the right.
              On small screens it tucks just inside the header padding so it
              doesn't overlap the hamburger. */}
          <div className="shrink-0">
            <LanguageSwitcher />
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-[60] liquid-glass-strong [backdrop-filter:blur(40px)] overflow-y-auto"
          >
            <div className="absolute top-4 right-4">
              <button
                type="button"
                aria-label="Close menu"
                className="size-10 rounded-full liquid-glass flex items-center justify-center text-foreground"
                onClick={() => setOpen(false)}
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-full flex flex-col items-center justify-center gap-1 px-6 py-20">
              {NAV_ITEMS.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="w-full flex flex-col items-center"
                >
                  <MobileNavRow item={item} onSelect={() => setOpen(false)} />
                </motion.div>
              ))}
              <Button variant="hero" asChild className="mt-6">
                <Link href={SIGNUP_HREF} onClick={() => setOpen(false)}>
                  Get Started
                  <ArrowUpRight className="ml-1 size-4" />
                </Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
