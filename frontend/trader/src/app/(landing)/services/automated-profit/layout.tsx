import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Automated Profit Generation | Algo Investment Plans | SwisDex',
  description:
    'Hands-free algorithmic investment plans — Starter, Growth, Elite. Capital protection, daily tracking, flexible withdrawal, transparent reports.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
