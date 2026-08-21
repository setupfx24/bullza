'use client';

import { motion, useInView, animate, useMotionValue, useTransform } from 'motion/react';
import { useEffect, useRef } from 'react';
import { Star } from 'lucide-react';
import { SOCIAL_PROOF, STATS } from '../data';

/**
 * Social-proof strip — star rating + the headline counters.
 *
 * COMPLIANCE NOTE: every figure rendered here comes from `STATS` in
 * data.ts, which is the site's existing set of claims. The star rating is
 * deliberately QUALITATIVE (no "4.9 from 2,412 reviews") because no
 * audited review score exists to cite. Do not add a new number to this
 * section without a verifiable source — a broker publishing invented
 * trader counts or volumes is a regulatory problem, not a design choice.
 */

function parseStat(raw: string): { num: number | null; suffix: string; prefix: string } {
  // Handles "90%", "50,000+", "Upto 7%", "24/7".
  const match = raw.match(/^([A-Za-z ]*?)\s*([0-9][0-9,.]*)(.*)$/);
  if (!match) return { num: null, suffix: raw, prefix: '' };
  const num = parseFloat(match[2].replace(/,/g, ''));
  if (Number.isNaN(num)) return { num: null, suffix: raw, prefix: '' };
  // A slash means it's a composite label like "24/7" — never count it up.
  if (match[3].startsWith('/')) return { num: null, suffix: raw, prefix: '' };
  return { num, suffix: match[3], prefix: match[1] ? `${match[1]} ` : '' };
}

const numberStyle: React.CSSProperties = {
  fontSize: 'clamp(1.9rem, 1.3rem + 2.2vw, 3rem)',
  lineHeight: 1,
  fontWeight: 800,
  letterSpacing: '-0.03em',
  color: 'var(--mk-text)',
  whiteSpace: 'nowrap',
};

function AnimatedValue({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const motionVal = useMotionValue(0);
  const { num, suffix, prefix } = parseStat(value);
  const display = useTransform(motionVal, (v) => {
    if (num == null) return value;
    const isInt = Number.isInteger(num);
    const formatted = isInt
      ? Math.round(v).toLocaleString('en-US')
      : v.toFixed(1);
    return `${prefix}${formatted}${suffix}`;
  });

  useEffect(() => {
    if (!inView || num == null) return;
    const controls = animate(motionVal, num, { duration: 1.6, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [inView, num, motionVal]);

  if (num == null) {
    return (
      <span ref={ref} style={numberStyle} className="tabular-nums">
        {value}
      </span>
    );
  }

  return <motion.span ref={ref} style={numberStyle} className="tabular-nums">{display}</motion.span>;
}

export function Stats() {
  return (
    <section className="mk-section mk-section--raised" style={{ borderBlock: '1px solid var(--mk-line)' }}>
      <div className="mk-container">
        <div
          className="flex flex-col items-center text-center lg:flex-row lg:items-center lg:text-left"
          style={{ gap: 'var(--mk-space-7)' }}
        >
          {/* Rating — qualitative by design (see compliance note above). */}
          <div
            className="flex shrink-0 flex-col items-center lg:items-start"
            style={{ gap: 'var(--mk-space-2)' }}
          >
            <span className="flex" style={{ gap: 2, color: 'var(--mk-accent)' }} aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={16} className="fill-current" />
              ))}
            </span>
            <span className="font-bold" style={{ fontSize: 'var(--mk-text-sm)' }}>
              {SOCIAL_PROOF.ratingLabel}
            </span>
            <span style={{ fontSize: 'var(--mk-text-xs)', color: 'var(--mk-text-faint)' }}>
              {SOCIAL_PROOF.ratingSub}
            </span>
          </div>

          <span
            aria-hidden
            className="hidden lg:block self-stretch"
            style={{ width: 1, background: 'var(--mk-line)' }}
          />

          <div
            className="grid w-full grid-cols-2 lg:grid-cols-4"
            style={{ gap: 'var(--mk-space-6) var(--mk-space-5)' }}
          >
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.07 * i }}
                className="flex flex-col items-center lg:items-start"
                style={{ gap: 'var(--mk-space-2)' }}
              >
                <AnimatedValue value={stat.value} />
                <span
                  className="uppercase font-semibold"
                  style={{
                    fontSize: 'var(--mk-text-label)',
                    letterSpacing: 'var(--mk-tracking-label)',
                    color: 'var(--mk-text-faint)',
                  }}
                >
                  {stat.label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
