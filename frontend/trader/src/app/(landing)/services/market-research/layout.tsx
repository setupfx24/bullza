import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Market Research & Analysis | Daily Reports | SwisDex',
  description:
    'Daily technical & fundamental research across forex, crypto, indices, and commodities. Pre-market briefs, trade ideas, weekly outlooks — written by senior analysts.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
