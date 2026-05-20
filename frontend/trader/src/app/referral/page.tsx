'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Loader2, Users, DollarSign, Copy as CopyIcon, ArrowUpRight, Gift } from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import api from '@/lib/api/client';

interface BusinessStatus {
  is_ib: boolean;
  application_status?: string | null;
}

interface IBDashboard {
  referral_code: string;
  referral_link: string;
  level: number;
  total_referrals: number;
  total_commission: number;
  total_earned: number;
  pending_payout: number;
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ReferralPage() {
  const [status, setStatus] = useState<BusinessStatus | null>(null);
  const [dashboard, setDashboard] = useState<IBDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const s = await api.get<BusinessStatus>('/business/status');
        setStatus(s);
        if (s.is_ib) {
          try {
            const d = await api.get<IBDashboard>('/business/ib/dashboard');
            setDashboard(d);
          } catch {
            /* dashboard fetch can fail before backend has materialised the first IB row */
          }
        }
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

  return (
    <DashboardShell>
      <div className="px-6 py-6 space-y-6 max-w-[1000px] mx-auto">
        <header>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Gift size={22} className="text-accent" /> Referral
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Invite friends with your link. You earn a share of their trading commissions —
            credited straight to your wallet, withdrawable or tradeable.
          </p>
        </header>

        {!status?.is_ib ? (
          <section className="rounded-xl border border-border-primary bg-card p-6 text-center space-y-3">
            <Users size={32} className="text-accent mx-auto" />
            <h2 className="text-lg font-semibold text-text-primary">Start your referral program</h2>
            <p className="text-sm text-text-secondary max-w-md mx-auto">
              {status?.application_status === 'pending'
                ? 'Your application is under review. Once approved, your referral link will appear here and you will start earning on referred-user trades.'
                : 'Activate the Introducing Broker program from the Affiliates page to get your personal referral link and start earning commissions on every trade your referrals make.'}
            </p>
            {status?.application_status !== 'pending' && (
              <Link
                href="/business"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent text-white font-semibold text-sm hover:opacity-90"
              >
                Activate Now <ArrowUpRight size={14} />
              </Link>
            )}
          </section>
        ) : (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total Earned',   value: `$${fmt(dashboard?.total_earned || 0)}`,    color: 'text-buy',     icon: DollarSign },
                { label: 'Pending Payout', value: `$${fmt(dashboard?.pending_payout || 0)}`,  color: 'text-amber-400', icon: DollarSign },
                { label: 'Referrals',      value: String(dashboard?.total_referrals || 0),    color: 'text-accent',  icon: Users },
                { label: 'Level',          value: `L${dashboard?.level || 1}`,                color: 'text-text-primary', icon: Gift },
              ].map((c) => (
                <div key={c.label} className="rounded-xl border border-border-primary bg-card p-4">
                  <div className="flex items-center gap-2 text-xs text-text-tertiary">
                    <c.icon size={12} /> {c.label}
                  </div>
                  <p className={`text-xl font-bold font-mono tabular-nums mt-1 ${c.color}`}>{c.value}</p>
                </div>
              ))}
            </section>

            {dashboard?.referral_link && (
              <section className="rounded-xl border border-border-primary bg-card p-5 space-y-3">
                <div>
                  <p className="text-xs text-text-tertiary mb-2">Your referral link</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={dashboard.referral_link}
                      className="flex-1 text-xs font-mono bg-bg-secondary border border-border-primary rounded-md px-3 py-2 text-text-primary"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(dashboard.referral_link);
                        toast.success('Copied');
                      }}
                      className="shrink-0 inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-md border border-accent text-accent hover:bg-accent hover:text-white transition-colors"
                    >
                      <CopyIcon size={12} /> Copy
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-tertiary">
                  <span>
                    Referral code:{' '}
                    <code className="font-mono text-text-secondary bg-bg-secondary px-1.5 py-0.5 rounded">
                      {dashboard.referral_code}
                    </code>
                  </span>
                  <Link
                    href="/business"
                    className="inline-flex items-center gap-1 text-accent hover:underline"
                  >
                    View full IB dashboard <ArrowUpRight size={11} />
                  </Link>
                </div>
              </section>
            )}

            <section className="rounded-xl border border-accent/25 bg-accent/[0.04] p-4 text-xs text-text-secondary leading-relaxed">
              Earnings auto-credit to your main wallet whenever a commission settles. Withdraw them from
              the Wallet page or transfer into any trading account to trade with them — no separate
              balance to manage.
            </section>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
