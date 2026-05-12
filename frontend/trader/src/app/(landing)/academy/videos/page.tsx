'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, PlayCircle, Clock, ArrowUpRight, ArrowLeft, ArrowRight } from 'lucide-react';
import { BannerPlaceholder } from '@/swisdex/components/BannerPlaceholder';

type Level = 'Beginner' | 'Intermediate' | 'Advanced';
type Category = 'Forex' | 'Crypto' | 'Strategy' | 'Platform';

interface Video {
  id: string;
  title: string;
  description: string;
  duration: string;
  category: Category;
  level: Level;
}

const VIDEOS: Video[] = [
  { id: 'v1',  title: 'Forex Basics: Reading Price Action',            description: 'Understand candlesticks, support, resistance, and how to read a chart without indicators.',                       duration: '12:45', category: 'Forex',    level: 'Beginner'     },
  { id: 'v2',  title: 'Position Sizing with the 1% Rule',              description: 'Calculate lot size from account balance, stop-loss distance, and risk tolerance — every trade.',                duration: '08:20', category: 'Strategy', level: 'Beginner'     },
  { id: 'v3',  title: 'Smart Money Concepts Explained',                description: 'Order blocks, liquidity sweeps, and break-of-structure — what institutional traders actually look at.',         duration: '24:10', category: 'Strategy', level: 'Advanced'     },
  { id: 'v4',  title: 'Trading the London Open',                       description: 'A session-based playbook for the London open with examples on GBP/USD and EUR/USD.',                            duration: '18:30', category: 'Forex',    level: 'Intermediate' },
  { id: 'v5',  title: 'Bitcoin & Altcoin Cycle Theory',                description: 'How BTC dominance, halving cycles, and on-chain data align — and where altcoins fit in.',                       duration: '21:55', category: 'Crypto',   level: 'Intermediate' },
  { id: 'v6',  title: 'Building a Trading Plan That Sticks',           description: 'Entry rules, exit rules, max daily loss, journaling — the non-negotiables of a professional plan.',             duration: '15:05', category: 'Strategy', level: 'Beginner'     },
  { id: 'v7',  title: 'Using TradingView on the SwisDex Platform',     description: 'Custom indicators, alerts, multi-chart layouts, and one-click trade execution.',                                 duration: '10:40', category: 'Platform', level: 'Beginner'     },
  { id: 'v8',  title: 'Risk-On vs Risk-Off: Macro Sentiment',          description: 'How DXY, US10Y, and equity indices shape forex direction on any given week.',                                   duration: '19:15', category: 'Strategy', level: 'Advanced'     },
  { id: 'v9',  title: 'Stablecoins and Crypto Liquidity',              description: 'USDT, USDC, and the role of stablecoin flows in crypto market structure.',                                      duration: '13:25', category: 'Crypto',   level: 'Intermediate' },
];

const LEVELS: Array<'All' | Level>   = ['All', 'Beginner', 'Intermediate', 'Advanced'];
const CATEGORIES: Array<'All' | Category> = ['All', 'Forex', 'Crypto', 'Strategy', 'Platform'];
const PAGE_SIZE = 6;

export default function AcademyVideosPage() {
  const [category, setCategory] = useState<'All' | Category>('All');
  const [level, setLevel]       = useState<'All' | Level>('All');
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(1);

  const filtered = useMemo(() => {
    return VIDEOS.filter((v) => {
      if (category !== 'All' && v.category !== category) return false;
      if (level    !== 'All' && v.level    !== level)    return false;
      if (search && !`${v.title} ${v.description}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [category, level, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <main className="min-h-screen bg-background">
      <BannerPlaceholder
        title="SwisDex Academy — Videos"
        tagline="Bite-sized lessons on forex, crypto, and strategy. Built by traders who actually trade."
      />

      {/* Filter bar */}
      <section id="filters" className="mx-auto max-w-[1200px] px-[var(--gutter)] py-6 sm:py-10 border-y border-border">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_2fr] gap-3 sm:gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-[0.16em] text-foreground/55">Category</span>
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value as 'All' | Category); setPage(1); }}
              className="liquid-glass rounded-xl px-3 py-2.5 text-sm bg-transparent text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
              aria-label="Filter by category"
            >
              {CATEGORIES.map((c) => <option key={c} value={c} className="bg-background">{c}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-[0.16em] text-foreground/55">Level</span>
            <select
              value={level}
              onChange={(e) => { setLevel(e.target.value as 'All' | Level); setPage(1); }}
              className="liquid-glass rounded-xl px-3 py-2.5 text-sm bg-transparent text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
              aria-label="Filter by skill level"
            >
              {LEVELS.map((l) => <option key={l} value={l} className="bg-background">{l}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-[0.16em] text-foreground/55">Search</span>
            <div className="liquid-glass rounded-xl flex items-center gap-2 px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-primary/60">
              <Search className="size-4 text-foreground/55 shrink-0" />
              <input
                type="search"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search lessons…"
                className="bg-transparent text-sm text-foreground placeholder:text-foreground/40 outline-none flex-1 min-w-0"
                aria-label="Search videos"
              />
            </div>
          </label>
        </div>
        <p className="mt-4 text-xs text-foreground/55">
          {filtered.length} video{filtered.length === 1 ? '' : 's'} found
        </p>
      </section>

      {/* Video grid */}
      <section id="videos" className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16 md:py-20">
        {pageItems.length === 0 ? (
          <div className="liquid-glass rounded-2xl p-10 text-center text-foreground/65">
            No videos match the current filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {pageItems.map((v) => (
              <article key={v.id} className="liquid-glass rounded-2xl overflow-hidden flex flex-col">
                {/* TODO: Video thumbnail image yahan aayegi */}
                <div
                  className="image-placeholder relative aspect-video bg-foreground/[0.06] flex items-center justify-center"
                  aria-label={`${v.title} thumbnail`}
                >
                  <PlayCircle className="size-12 text-foreground/40" aria-hidden />
                  <span className="absolute bottom-2 right-2 text-[11px] px-2 py-0.5 rounded-md bg-background/80 text-foreground/85 inline-flex items-center gap-1">
                    <Clock className="size-3" /> {v.duration}
                  </span>
                </div>
                <div className="p-5 flex flex-col gap-3 flex-1">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em]">
                    <span className="text-primary">{v.category}</span>
                    <span className="text-foreground/40">•</span>
                    <span className="text-foreground/65">{v.level}</span>
                  </div>
                  <h3 className="font-display text-lg uppercase tracking-tight text-foreground leading-tight">
                    {v.title}
                  </h3>
                  <p className="text-sm text-foreground/65 leading-relaxed flex-1">{v.description}</p>
                  <button
                    type="button"
                    className="mt-2 self-start inline-flex items-center gap-2 text-sm font-semibold text-primary hover:opacity-80"
                    aria-label={`Watch ${v.title}`}
                  >
                    Watch Now <ArrowUpRight className="size-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <nav className="mt-12 flex items-center justify-center gap-2" aria-label="Pagination">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="size-10 rounded-full liquid-glass flex items-center justify-center text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ArrowLeft className="size-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                aria-current={n === safePage ? 'page' : undefined}
                className={`size-10 rounded-full text-sm font-semibold ${
                  n === safePage ? 'bg-primary text-white' : 'liquid-glass text-foreground/80 hover:text-foreground'
                }`}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="size-10 rounded-full liquid-glass flex items-center justify-center text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ArrowRight className="size-4" />
            </button>
          </nav>
        )}
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1200px] px-[var(--gutter)] pb-20">
        <div className="liquid-glass-strong rounded-3xl p-8 sm:p-12 text-center">
          <h2 className="font-display uppercase text-2xl sm:text-3xl tracking-tight">Ready to put the lessons to work?</h2>
          <p className="mt-4 text-foreground/70 max-w-xl mx-auto text-sm sm:text-base">Open a free demo, practice with $10,000 virtual funds, and follow along live.</p>
          <Link
            href="/auth/register?type=demo"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary text-white px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity"
          >
            Open Free Demo <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
