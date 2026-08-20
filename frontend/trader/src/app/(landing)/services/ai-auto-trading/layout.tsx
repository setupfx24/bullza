import type { Metadata } from 'next';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: `AI-Driven Auto Trading | 24/7 Algo Execution | ${BRAND_NAME}`,
  description:
    `${BRAND_NAME} AI trading engine analyses thousands of market signals per second and executes high-frequency trades 24/7 — verified 90% accuracy across forex and crypto.`,
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
