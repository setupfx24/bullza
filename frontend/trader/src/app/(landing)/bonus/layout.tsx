import type { Metadata } from 'next';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Welcome Bonus — Up to $1,000 on First Deposit | ${BRAND_NAME}`,
  description:
    'Tiered welcome bonus on your first deposit. 100% match on every tier — $100 → $100, $500 → $500, $1,000 or more → full $1,000 match. Auto-credited within minutes of funding.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
