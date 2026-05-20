'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Loader2, Users, DollarSign, Copy as CopyIcon, ArrowUpRight, Gift } from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import api from '@/lib/api/client';

interface ReferralDashboard {
  referral_code: string | null;
  referrals: number;
  total_earned: number;
  commission_pct: number;
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
            Invite friends and earn{' '}
            <strong className="text-text-primary">{data?.commission_pct ?? 0}%</strong>{' '}
            of their first deposit, credited straight to your wallet.
            For the bigger multi-level commission program, see{' '}
            <Link href="/business" className="text-accent hover:underline">Affiliates (IB)</Link>.
          </p>
        </header>

        {/* Stats */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border-primary bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-text-tertiary uppercase">
              <Users size={12} /> Referrals
            </div>
            <p className="text-xl font-bold font-mono tabular-nums mt-1 text-accent">
              {data?.referrals ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-border-primary bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-text-tertiary uppercase">
              <DollarSign size={12} /> Total Earned
            </div>
            <p className="text-xl font-bold font-mono tabular-nums mt-1 text-buy">
              ${fmt(data?.total_earned ?? 0)}
            </p>
          </div>
          <div className="rounded-xl border border-border-primary bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-text-tertiary uppercase">
              <Gift size={12} /> Rate
            </div>
            <p className="text-xl font-bold font-mono tabular-nums mt-1 text-text-primary">
              {data?.commission_pct ?? 0}%
            </p>
            <p className="text-[10px] text-text-tertiary mt-0.5">paid on first deposit</p>
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

        <section className="rounded-xl border border-accent/25 bg-accent/[0.04] p-4 text-xs text-text-secondary leading-relaxed">
          Commission is paid in cash once each referred user makes their first approved deposit.
          The amount goes straight to your <strong className="text-text-primary">main wallet</strong>
          {' '}— withdraw it from the Wallet page or transfer into any trading account to trade with it.
        </section>
      </div>
    </DashboardShell>
  );
}
