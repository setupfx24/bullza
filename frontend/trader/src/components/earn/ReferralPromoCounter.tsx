'use client';

import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import api from '@/lib/api/client';

interface Campaign {
  id: string;
  name: string;
  amount_usd: string;
  claimed: number;
  max: number;
  remaining: number;
  required_trades: number;
}

const POLL_INTERVAL_MS = 30_000;

export function ReferralPromoCounter() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await api.get<{ items: Campaign[] }>('/referral/promo/campaigns');
        if (!cancelled) setCampaigns(data.items || []);
      } catch {
        // Silent fail — promotional banner, not critical UI.
      }
    }

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (campaigns.length === 0) return null;

  // Multiple campaigns could theoretically run at once — stack them, most
  // recently created (i.e. first in the array, since the backend already
  // orders newest-first) shown first.
  return (
    <div className="space-y-3">
      {campaigns.map((c) => (
        <CampaignBanner key={c.id} campaign={c} />
      ))}
    </div>
  );
}

function CampaignBanner({ campaign }: { campaign: Campaign }) {
  const pct = campaign.max > 0 ? Math.min(100, (campaign.claimed / campaign.max) * 100) : 0;
  const qualifyText =
    campaign.required_trades > 0
      ? `once they complete KYC and ${campaign.required_trades} trade${campaign.required_trades === 1 ? '' : 's'}`
      : 'the moment they complete KYC';

  return (
    <section className="relative overflow-hidden rounded-xl border border-buy/40 bg-gradient-to-br from-buy/[0.12] via-card to-card p-5">
      <div
        className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-buy/20 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-buy/20 text-buy">
            <Zap size={11} className="fill-buy" /> {campaign.name}
          </span>
          <h3 className="mt-2 text-lg sm:text-xl font-bold text-text-primary">
            Get <span className="text-buy">${campaign.amount_usd} instantly</span>
          </h3>
          <p className="mt-1 text-sm text-text-secondary max-w-md">
            Refer a friend and get paid {qualifyText}. Only {campaign.max} spots available.
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-2xl font-bold font-mono tabular-nums text-buy">{campaign.remaining}</p>
          <p className="text-[10px] text-text-tertiary uppercase tracking-wide">spots left</p>
        </div>
      </div>

      <div className="relative mt-4 space-y-1.5">
        <div className="h-2 rounded-full bg-bg-tertiary overflow-hidden">
          <div className="h-full bg-buy transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between text-[11px] text-text-tertiary">
          <span>{campaign.claimed} claimed</span>
          <span>{campaign.max} total spots</span>
        </div>
      </div>
    </section>
  );
}
