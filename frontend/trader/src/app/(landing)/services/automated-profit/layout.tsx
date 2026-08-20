import type { Metadata } from 'next';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Automated Profit Generation | Algo Investment Plans | ${BRAND_NAME}`,
  description:
    'Hands-free algorithmic investment plans — Starter, Growth, Elite. Capital protection, daily tracking, flexible withdrawal, transparent reports.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
