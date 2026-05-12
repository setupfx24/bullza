import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Welcome Bonus — Up to $1,000 on First Deposit | SwisDex',
  description:
    'Tiered welcome bonus on your first deposit. $100 deposit → $100 bonus, $500 → $300, $1,000 → $1,000 matching bonus. Auto-credited within minutes of funding.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
