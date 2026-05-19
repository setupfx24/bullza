'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import { BlurText } from './BlurText';
import { Button } from '../ui/Button';
import { SIGNUP_HREF } from '../data';

const STEPS = [
  { n: 1, title: 'Register', body: 'Complete our secure online application in minutes.' },
  { n: 2, title: 'Fund',     body: 'Choose from multiple fee-free deposit options.' },
  { n: 3, title: 'Trade',    body: "Access the world's largest markets directly from your SwisDex account." },
];

export function Process() {
  return (
    <section id="process" className="relative py-16 sm:py-24 md:py-32 lg:py-40 border-t border-border">
      <div
        className="max-w-[var(--max)] mx-auto"
        style={{ paddingLeft: 'var(--gutter)', paddingRight: 'var(--gutter)' }}
      >
        <div className="flex flex-col items-start gap-5 mb-10 sm:mb-14 md:mb-20">
          <span className="liquid-glass rounded-full px-4 py-1.5 text-xs text-foreground/80">
            How It Works
          </span>
          <BlurText
            text="A New Era of Intelligent Trading"
            as="h2"
            className="font-display uppercase text-3xl sm:text-4xl md:text-6xl leading-[0.9] tracking-tight max-w-[18ch]"
          />
          <p className="font-body text-foreground/60 max-w-2xl text-sm sm:text-base">
            SwisDex is a leading AI-driven cryptocurrency and forex investment company. From sign-up to first profit in three simple steps — whether you are a first-time investor or a seasoned trader.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 md:gap-20 items-start">
          <div className="md:sticky md:top-32">
            <h3 className="font-display uppercase text-2xl sm:text-3xl md:text-5xl leading-[0.95] tracking-tight">
              Start Trading in
              <br />
              <span className="text-primary">3 Simple Steps</span>
            </h3>
            <p className="mt-5 font-body text-foreground/60 max-w-md">
              From signup to your first live position in three guided steps — no paperwork, no hold-ups, no surprises.
            </p>
            <div className="mt-8">
              <Button variant="hero" asChild>
                <Link href={SIGNUP_HREF}>
                  Register
                  <ArrowUpRight className="ml-1 size-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-8 md:gap-10">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 18, filter: 'blur(4px)' }}
                whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.08 * i }}
                className="flex items-start gap-5"
              >
                <span className="shrink-0 size-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-base">
                  {step.n}
                </span>
                <div>
                  <h4 className="font-display uppercase text-xl md:text-2xl tracking-tight">
                    {step.title}
                  </h4>
                  <p className="mt-2 font-body text-sm md:text-[15px] text-foreground/65 leading-relaxed max-w-[40ch]">
                    {step.body}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
