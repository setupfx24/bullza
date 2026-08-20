import type { Metadata } from 'next';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: `AI-POWERED STAKING PROGRAM | Capital-Protected Yield Plans | ${BRAND_NAME}`,
  description: 'Capital-protected, fixed-yield insurance plans for risk-averse investors. 6, 12, or 24 month tenures. From 6.5% to 10% annualised.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
