'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Loader2, Users, DollarSign, Copy as CopyIcon, ArrowUpRight, Gift } from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import api from '@/lib/api/client';

interface ReferralDashboard {
  referral_code: string | null;
  /** Total users this user has referred (qualified + pending combined). */
  referrals: number;
  /** Referrals who already hit the trade threshold and paid out. */
  qualified_referrals?: number;
  /** Referrals signed up but haven't yet closed enough trades. */
  pending_referrals?: number;
  total_earned: number;
  /** Flat USD amount paid per qualified referral (legacy fallback). */
  amount_per_referral_usd?: number;
  /** Per-account-type payout. Keys are lowercased account-group names
      (standard / ecn / vip). The engine picks the rate matching the
      referred user's primary trading account. */
  amount_by_account_type?: Record<string, number>;
  /** Number of closed trades a referred user must complete (default 3). */
  required_trades?: number;
  /** Legacy field — older builds return a percentage; new clients ignore. */
  commission_pct?: number;
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getOrigin() {
  if (typeof window === 'undefined') return 'https://swisdex.com';
  return window.location.origin;
}

export default function ReferralPage() {
  const [data, setData] = useState<ReferralDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const d = await api.get<ReferralDashboard>('/business/referral/me');
        setData(d);
      } catch (e: any) {
        toast.error(e?.message || 'Failed to load referral info');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-accent" size={24} />
        </div>
      </DashboardShell>
    );
  }

  const link = data?.referral_code
    ? `${getOrigin()}/auth/register?ref=${data.referral_code}`
    : '';

  return (
    <DashboardShell>
      <div className="px-4 sm:px-6 py-6 space-y-6 max-w-[1000px] mx-auto">
        <header>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Gift size={22} className="text-accent" /> Referral
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Invite friends and earn a flat{' '}
            <strong className="text-text-primary">${fmt(data?.amount_per_referral_usd ?? 0)}</strong>{' '}
            per qualified referral. They qualify after completing{' '}
            <strong className="text-text-primary">{data?.required_trades ?? 3}</strong>{' '}
            closed trades.
            For the bigger multi-level commission program, see{' '}
            <Link href="/business" className="text-accent hover:underline">Affiliates (IB)</Link>.
          </p>
        </header>

        {/* Stats */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border-primary bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-text-tertiary uppercase">
              <Users size={12} /> Total referrals
            </div>
            <p className="text-xl font-bold font-mono tabular-nums mt-1 text-accent">
              {data?.referrals ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-border-primary bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-text-tertiary uppercase">
              <Gift size={12} /> Qualified
            </div>
            <p className="text-xl font-bold font-mono tabular-nums mt-1 text-buy">
              {data?.qualified_referrals ?? 0}
            </p>
            <p className="text-[10px] text-text-tertiary mt-0.5">paid out</p>
          </div>
          <div className="rounded-xl border border-border-primary bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-text-tertiary uppercase">
              <Users size={12} /> Pending
            </div>
            <p className="text-xl font-bold font-mono tabular-nums mt-1 text-amber-400">
              {data?.pending_referrals ?? 0}
            </p>
            <p className="text-[10px] text-text-tertiary mt-0.5">need {data?.required_trades ?? 3} trades</p>
          </div>
          <div className="rounded-xl border border-border-primary bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-text-tertiary uppercase">
              <DollarSign size={12} /> Total Earned
            </div>
            <p className="text-xl font-bold font-mono tabular-nums mt-1 text-buy">
              ${fmt(data?.total_earned ?? 0)}
            </p>
          </div>
        </section>

        {/* Link */}
        {data?.referral_code ? (
          <section className="rounded-xl border border-border-primary bg-card p-5 space-y-3">
            <div>
              <p className="text-xs text-text-tertiary mb-2">Your referral link</p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={link}
                  className="flex-1 text-xs font-mono bg-bg-secondary border border-border-primary rounded-md px-3 py-2 text-text-primary min-w-0"
                />
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(link); toast.success('Copied'); }}
                  className="shrink-0 inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold rounded-md border border-accent text-accent hover:bg-accent hover:text-white transition-colors"
                >
                  <CopyIcon size={12} /> Copy link
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-tertiary">
              <span>
                Code:{' '}
                <code className="font-mono text-text-secondary bg-bg-secondary px-1.5 py-0.5 rounded">
                  {data.referral_code}
                </code>
              </span>
              <Link href="/business" className="inline-flex items-center gap-1 text-accent hover:underline">
                IB / Affiliates dashboard <ArrowUpRight size={11} />
              </Link>
            </div>
          </section>
        ) : (
          <section className="rounded-xl border border-border-primary bg-card p-6 text-center text-sm text-text-secondary">
            Your referral code is being generated. Refresh the page in a moment.
          </section>
        )}

        <section className="rounded-xl border border-accent/25 bg-accent/[0.04] p-4 text-xs text-text-secondary leading-relaxed space-y-3">
          <div>
            <strong className="text-text-primary">How it works:</strong> share your link → friend
            registers with your code → they close{' '}
            <strong className="text-text-primary">{data?.required_trades ?? 3}</strong> trades →
            you get a flat USD payout credited to your main wallet. Withdraw or trade with it
            as you like — no separate balance.
          </div>

          {data?.amount_by_account_type && Object.keys(data.amount_by_account_type).length > 0 && (
            <div>
              <p className="text-text-tertiary mb-1.5">Payout by your friend&apos;s account type:</p>
              <div className="grid grid-cols-3 gap-2">
                {(['standard', 'ecn', 'vip'] as const).map((k) => {
                  const v = data.amount_by_account_type?.[k];
                  if (v == null) return null;
                  return (
                    <div key={k} className="rounded-md bg-bg-secondary border border-border-primary px-2 py-1.5">
                      <div className="text-[10px] uppercase tracking-wider text-text-tertiary">{k}</div>
                      <div className="text-text-primary font-mono tabular-nums">${fmt(v)}</div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-text-tertiary mt-1.5">
                The engine matches your friend&apos;s primary trading-account type to pick the rate.
                Higher-tier subscriptions pay more.
              </p>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
