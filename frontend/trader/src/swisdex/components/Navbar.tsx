'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from 'motion/react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { NAV_ITEMS, BRAND, SIGNUP_HREF } from '../data';

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollY } = useScroll();
  const pathname = usePathname();

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
        <nav
          className={`liquid-glass rounded-full mx-auto w-full max-w-[1200px] px-2 py-2 flex items-center justify-between gap-4 transition-[backdrop-filter] ${
            scrolled ? '[backdrop-filter:blur(28px)]' : ''
          }`}
        >
          <Link href="/" className="flex items-center gap-2 pl-3 group">
            <img
              src={BRAND.logo}
              alt={BRAND.name}
              className="h-8 w-auto object-contain"
            />
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative px-3.5 py-2 text-sm transition-colors font-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-full ${
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
            })}
          </div>

          <div className="hidden md:flex items-center gap-2">
            <Button variant="heroSolid" className="rounded-full px-4 py-1.5 text-sm h-auto" asChild>
              <Link href={SIGNUP_HREF}>
                Get Started
                <ArrowUpRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>

          <div className="md:hidden flex items-center gap-2 mr-2">
            <button
              type="button"
              aria-label="Open menu"
              className="size-9 rounded-full liquid-glass-strong flex items-center justify-center text-foreground"
              onClick={() => setOpen(true)}
            >
              <Menu className="size-4" />
            </button>
          </div>
        </nav>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 z-[60] liquid-glass-strong [backdrop-filter:blur(40px)]"
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
            <div className="h-full flex flex-col items-center justify-center gap-2 px-6">
              {NAV_ITEMS.map((item, i) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="font-display uppercase text-3xl tracking-tight text-foreground/85 hover:text-foreground py-2 block"
                  >
                    {item.label}
                  </Link>
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
