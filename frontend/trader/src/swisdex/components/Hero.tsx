'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Network,
  ShieldCheck,
  BadgeCheck,
  type LucideIcon,
} from 'lucide-react';
import { useRef } from 'react';
import { BubbleText } from '../ui/BubbleText';
import { Button } from '../ui/Button';
import { TypewriterText } from './TypewriterText';
import { LiveTickerBar } from './LiveTickerBar';
import LineWaves from './LineWaves';
import { HERO, HERO_TRUST_PILLS } from '../data';

// Icon name -> lucide component. Kept tiny so we don't ship the full
// lucide bundle just for hero pills.
const TRUST_ICON_MAP: Record<string, LucideIcon> = {
  Network,
  ShieldCheck,
  BadgeCheck,
};

export function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  return (
    <section ref={heroRef} className="relative h-screen bg-background">
      <div className="relative h-screen w-full overflow-hidden">
        {/* Animated WebGL shader background */}
        <div
          className="absolute inset-0 z-[1]"
          style={{ background: '#000', minHeight: '400px', opacity: 0.55 }}
          aria-hidden
        >
          <LineWaves
            speed={0.3}
            innerLineCount={32}
            outerLineCount={36}
            warpIntensity={1}
            rotation={-45}
            edgeFadeWidth={0}
            colorCycleSpeed={1.4}
            brightness={0.22}
            color1="#d00000"
            color2="#55a630"
            color3="#ffffff"
            enableMouseInteraction
            mouseInfluence={2}
          />
        </div>

        <p className="sr-only">
          SwisDex hero — AI-powered cryptocurrency and forex investment platform.
        </p>

        <div className="absolute inset-0 z-[2] bg-black/30 pointer-events-none" />
        <div className="absolute inset-0 z-[3] bg-[radial-gradient(55%_45%_at_50%_50%,rgba(0,0,0,0.7)_0%,rgba(0,0,0,0.2)_60%,transparent_100%)] pointer-events-none" />
        <div className="absolute bottom-0 inset-x-0 h-[40vh] z-[4] gradient-fade-b pointer-events-none" />

        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-6 pointer-events-none">
          <motion.div
            initial={{ filter: 'blur(10px)', opacity: 0, y: 16 }}
            animate={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto"
          >
            <BubbleText
              text={HERO.headline}
              as="h1"
              className="font-display uppercase text-[clamp(36px,5.5vw,88px)] leading-[1.05] tracking-[-0.02em] text-foreground whitespace-nowrap font-light"
            />
          </motion.div>

          <TypewriterText
            text={HERO.sub}
            duration={5}
            startDelay={0.9}
            className="mt-6 font-body text-base md:text-lg text-foreground/70 max-w-2xl leading-relaxed min-h-[3em]"
          />

          {/* Three trust pills — Decentralised Exchange / Insured Trade / Licensed Broker.
              First read for any visitor; positions SwisDex against custodial brokers. */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.6 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3 pointer-events-auto"
          >
            {HERO_TRUST_PILLS.map((p) => {
              const Icon = TRUST_ICON_MAP[p.icon] ?? ShieldCheck;
              return (
                <div
                  key={p.label}
                  className="liquid-glass rounded-full pl-2 pr-4 py-2 flex items-center gap-2.5"
                  title={p.sub}
                >
                  <span className="liquid-glass-strong rounded-full size-7 flex items-center justify-center shrink-0">
                    <Icon className="size-3.5 text-[#7dc24f]" />
                  </span>
                  <span className="font-display uppercase tracking-wide text-xs sm:text-sm text-foreground whitespace-nowrap">
                    {p.label}
                  </span>
                </div>
              );
            })}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4, duration: 0.6 }}
            className="mt-8 flex items-center gap-3 flex-wrap justify-center pointer-events-auto"
          >
            <Button variant="hero" asChild>
              <Link href={HERO.ctaHref}>
                {HERO.ctaPrimary}
                <ArrowUpRight className="ml-1 size-4" />
              </Link>
            </Button>
            <Button variant="heroGlass" asChild>
              <Link href={HERO.ctaSecondaryHref}>{HERO.ctaSecondary}</Link>
            </Button>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.6, duration: 0.7 }}
          className="absolute bottom-0 inset-x-0 z-20"
        >
          <LiveTickerBar />
        </motion.div>
      </div>
    </section>
  );
}
