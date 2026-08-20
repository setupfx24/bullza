import type { Metadata } from 'next';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Lot Size & Profit Calculator | ${BRAND_NAME} Risk Management`,
  description: 'Free position-size calculator for forex traders. Set your risk %, stop-loss, and currency pair — get the recommended lot size instantly.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
