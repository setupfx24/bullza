import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'IB Referral Program | Earn Up to $7 per Lot | SwisDex',
  description: 'Become a SwisDex Introducing Broker. Lifetime per-lot commissions, multi-tier rewards, weekly payouts, dedicated manager.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
