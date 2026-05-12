'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight, BookOpen, Video, FileText, Users, Award, GraduationCap,
  PlayCircle, Layers, ChevronDown,
} from 'lucide-react';
import { BannerPlaceholder } from '@/swisdex/components/BannerPlaceholder';

const SIGNUP_HREF = '/auth/register';

export default function EducationPage() {
  return (
    <main className="min-h-screen bg-background">
      <BannerPlaceholder
        title="Educational Resources"
        tagline="Beginner to advanced — a structured trading curriculum built by professional traders. Free with every SwisDex account."
      />

      {/* Curriculum tracks */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full liquid-glass text-[11px] uppercase tracking-[0.16em] text-foreground/70">
            <span className="size-1.5 rounded-full bg-primary" /> Structured Learning
          </span>
          <h2 className="mt-5 font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">Three Learning Tracks</h2>
          <p className="mt-3 text-foreground/65 max-w-xl mx-auto text-sm sm:text-base">
            Pick the track that matches your level. Each is built in modules with checkpoints, exercises, and a final assessment.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { tier: 'Beginner',     hrs: '12 hours', n: 8,  body: 'Markets explained, order types, leverage and margin, reading a chart, building a first plan.' },
            { tier: 'Intermediate', hrs: '24 hours', n: 14, body: 'Technical patterns, fundamental drivers, position sizing, journal-and-review habits, intraday vs swing.' },
            { tier: 'Advanced',     hrs: '40 hours', n: 22, body: 'Inter-market analysis, regime detection, options for hedging, algorithmic execution, portfolio construction.' },
          ].map((t, i) => (
            <article key={t.tier} className={`rounded-3xl p-6 sm:p-8 ${i === 1 ? 'liquid-glass-strong ring-1 ring-primary/30' : 'liquid-glass'}`}>
              {i === 1 && (
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/25 text-primary text-[10px] uppercase tracking-[0.18em] font-semibold mb-3">
                  <span className="size-1.5 rounded-full bg-primary" /> Most Popular
                </span>
              )}
              <h3 className="font-display uppercase text-2xl tracking-tight">{t.tier}</h3>
              <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-foreground/55">{t.n} modules · {t.hrs}</div>
              <p className="mt-4 text-sm text-foreground/70 leading-relaxed">{t.body}</p>
              <Link href={SIGNUP_HREF} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                Start track <ArrowUpRight className="size-4" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* Resource types */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="text-center mb-10">
          <h2 className="font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">Resource Library</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { icon: Video,    title: 'Video Courses',  count: '120+', body: 'HD lessons with chart overlays, real platform demos, and downloadable cheat sheets.' },
            { icon: FileText, title: 'PDF Guides',     count: '60+',  body: 'Deep-dive eBooks on price action, indicators, and macro themes. Built for offline study.' },
            { icon: BookOpen, title: 'Blog Articles',  count: '300+', body: 'Daily market notes, trader interviews, and strategy breakdowns. New posts every weekday.' },
            { icon: Users,    title: 'Live Webinars',  count: '4 / week', body: 'Weekly live sessions — market open prep, strategy clinics, and Q&A with senior analysts.' },
          ].map(({ icon: Icon, title, count, body }) => (
            <article key={title} className="liquid-glass rounded-2xl p-6">
              <div className="size-11 rounded-xl bg-primary/25 flex items-center justify-center mb-4"><Icon className="size-5 text-primary" /></div>
              <h3 className="font-display text-lg uppercase tracking-tight">{title}</h3>
              <div className="mt-1 font-display text-2xl text-primary tabular-nums">{count}</div>
              <p className="mt-2 text-sm text-foreground/65 leading-relaxed">{body}</p>
            </article>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/academy/videos" className="inline-flex items-center gap-2 rounded-full liquid-glass px-5 py-2.5 text-sm font-semibold uppercase tracking-wider hover:bg-foreground/10">
            <PlayCircle className="size-4 text-primary" /> Videos
          </Link>
          <Link href="/academy/pdfs" className="inline-flex items-center gap-2 rounded-full liquid-glass px-5 py-2.5 text-sm font-semibold uppercase tracking-wider hover:bg-foreground/10">
            <FileText className="size-4 text-primary" /> PDFs
          </Link>
          <Link href="/academy/blogs" className="inline-flex items-center gap-2 rounded-full liquid-glass px-5 py-2.5 text-sm font-semibold uppercase tracking-wider hover:bg-foreground/10">
            <BookOpen className="size-4 text-primary" /> Blogs
          </Link>
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
        <div className="text-center mb-10">
          <h2 className="font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">Why Train With SwisDex</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: GraduationCap, title: 'Built by Working Traders', body: 'Every module is authored by an active trader with 10+ years of P&L on the screen — not a YouTube guru.' },
            { icon: Award,         title: 'Earn a Certificate',       body: 'Finish a track and pass the assessment to receive a SwisDex Academy certificate of completion.' },
            { icon: Layers,        title: 'Progressive Curriculum',   body: 'Concepts build on each other. You unlock advanced material only after mastering the prerequisites.' },
            { icon: Video,         title: 'Practical Demos',          body: 'Every concept is shown live on the SwisDex platform — no abstract theory, all chart and order ticket.' },
            { icon: Users,         title: 'Community Discord',        body: 'Discuss setups, share journals, and learn from peers. Moderated by the analyst desk.' },
            { icon: BookOpen,      title: 'Always Free',              body: 'No paywalls, no upgrades, no upsells. Every funded SwisDex account unlocks the full library.' },
          ].map(({ icon: Icon, title, body }) => (
            <article key={title} className="liquid-glass rounded-2xl p-6">
              <div className="size-11 rounded-xl bg-primary/25 flex items-center justify-center mb-4"><Icon className="size-5 text-primary" /></div>
              <h3 className="font-display text-lg uppercase tracking-tight">{title}</h3>
              <p className="mt-2 text-sm text-foreground/65 leading-relaxed">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-[800px] px-[var(--gutter)] py-12 sm:py-16">
        <h2 className="text-center font-display uppercase text-2xl sm:text-3xl tracking-tight mb-8">FAQ</h2>
        <div className="space-y-3">
          <FaqItem q="Is the Academy really free?">
            Yes. The full library — videos, PDFs, blogs, webinars — is included with every SwisDex account. No
            separate subscription or upgrade required. You also keep access if you withdraw and close your account.
          </FaqItem>
          <FaqItem q="Do I need a funded account to access it?">
            A free demo account is enough to access most content. A small set of advanced strategy modules
            requires a funded live account so you can practise alongside real market conditions.
          </FaqItem>
          <FaqItem q="How long does each track take?">
            Beginner ~12 hours, Intermediate ~24 hours, Advanced ~40 hours of video. Realistically allow 4–8
            weeks per track at 2–3 hours per week including practice.
          </FaqItem>
          <FaqItem q="Are the webinars recorded?">
            Yes — every live session is recorded and posted to the library within 24 hours, so you never miss
            a clinic even if the timing doesn't suit your region.
          </FaqItem>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pb-20">
        <div className="liquid-glass-strong rounded-3xl p-8 sm:p-12 text-center">
          <h2 className="font-display uppercase text-2xl sm:text-3xl tracking-tight">Start Learning Today</h2>
          <p className="mt-4 text-foreground/70 max-w-xl mx-auto text-sm sm:text-base">
            Sign up and the first module is in your dashboard within minutes. No card required for the demo.
          </p>
          <Link href={SIGNUP_HREF} className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary text-white px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:opacity-90">
            Open Free Account <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}

function FaqItem({ q, children }: { q: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="liquid-glass rounded-2xl">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left">
        <span className="font-display text-base sm:text-lg uppercase tracking-tight">{q}</span>
        <ChevronDown className={`size-5 text-foreground/55 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-5 pb-5 text-sm text-foreground/70 leading-relaxed">{children}</div>}
    </div>
  );
}
