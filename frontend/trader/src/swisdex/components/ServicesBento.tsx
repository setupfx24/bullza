'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import {
  ArrowUpRight,
  TrendingUp,
  Gem,
  BarChart2,
  Cpu,
  Building,
  Layers,
  type LucideIcon,
} from 'lucide-react';
import { BlurText } from './BlurText';
import { INSTRUMENTS } from '../data';

const iconMap: Record<string, LucideIcon> = {
  TrendingUp,
  Gem,
  BarChart2,
  Cpu,
  Building,
  Layers,
};

type Service = (typeof INSTRUMENTS)[number];

function Card({
  service,
  className,
  index,
}: {
  service: Service;
  className?: string;
  index: number;
}) {
  const Icon = iconMap[service.icon] ?? TrendingUp;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.05 * index }}
      whileHover={{ y: -4 }}
      className={`liquid-glass rounded-2xl relative overflow-hidden group ${className ?? ''}`}
    >
      <Link href={service.href} className="absolute inset-0 z-[1]" aria-label={service.title} />
      <div className="liquid-glass-strong rounded-full w-11 h-11 flex items-center justify-center mb-5">
        <Icon className="size-5 text-foreground" />
      </div>
      <h3 className="font-display uppercase text-2xl md:text-3xl leading-[0.95] tracking-tight mb-3 max-w-[18ch]">
        {service.title}
      </h3>
      <p className="font-body text-sm text-foreground/65 max-w-[38ch] leading-relaxed">
        {service.body}
      </p>
      <div className="mt-5">
        <span className="liquid-glass rounded-full px-3 py-1 text-xs font-body text-foreground/85 inline-block">
          {service.badge}
        </span>
      </div>

      {/* "Coming Soon" teaser on the featured (first / largest) card */}
      {index === 0 && (
        <div className="mt-5 sm:mt-7 pt-5 border-t border-foreground/10">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/25 text-primary text-[10px] uppercase tracking-[0.18em] font-semibold mb-2">
            <span className="relative inline-flex items-center justify-center">
              <span className="absolute size-1.5 rounded-full bg-primary opacity-75 animate-ping" />
              <span className="relative size-1.5 rounded-full bg-primary" />
            </span>
            Coming Soon
          </div>
          <h4 className="font-display uppercase font-extrabold tracking-tight leading-none text-foreground text-2xl sm:text-3xl md:text-4xl">
            EXX<span className="text-primary">9</span>
          </h4>
          <p className="mt-2 font-body text-[11px] sm:text-xs text-foreground/55 max-w-[28ch] leading-snug">
            Next-generation execution layer. Launching Q3 2026.
          </p>
        </div>
      )}

      <ArrowUpRight className="absolute top-6 right-6 size-5 text-foreground/30 group-hover:text-foreground/80 transition-colors" />
    </motion.div>
  );
}

export function ServicesBento() {
  return (
    <section id="services" className="relative py-16 sm:py-24 md:py-32 lg:py-40">
      <div
        className="max-w-[var(--max)] mx-auto"
        style={{ paddingLeft: 'var(--gutter)', paddingRight: 'var(--gutter)' }}
      >
        <div className="flex flex-col items-start gap-5 mb-10 sm:mb-14 md:mb-20">
          <span className="liquid-glass rounded-full px-4 py-1.5 text-xs text-foreground/80">
            What We Offer
          </span>
          <BlurText
            text="Comprehensive Investment Services Built for Growth"
            as="h2"
            className="font-display uppercase text-3xl sm:text-4xl md:text-6xl lg:text-7xl leading-[0.9] tracking-tight max-w-[18ch]"
          />
          <p className="font-body text-foreground/60 max-w-xl text-base md:text-lg">
            From AI-driven automation to expert oversight — SwisDex delivers the full investment toolkit on one platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 md:auto-rows-[260px]">
          <div className="md:row-span-2 md:col-span-1 min-h-[480px] md:min-h-0">
            <Card service={INSTRUMENTS[0]} className="p-8 h-full" index={0} />
          </div>
          <Card service={INSTRUMENTS[1]} className="p-6" index={1} />
          <Card service={INSTRUMENTS[2]} className="p-6" index={2} />
          <div className="md:col-span-2">
            <Card service={INSTRUMENTS[3]} className="p-7 h-full" index={3} />
          </div>
          <div className="md:col-span-3 md:row-auto">
            <Card service={INSTRUMENTS[4]} className="p-7 h-full min-h-[200px]" index={4} />
          </div>
          <div className="md:col-span-3 md:row-auto">
            <Card service={INSTRUMENTS[5]} className="p-7 h-full min-h-[200px]" index={5} />
          </div>
        </div>
      </div>
    </section>
  );
}
