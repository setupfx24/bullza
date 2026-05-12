import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI-Driven Auto Trading | 24/7 Algo Execution | SwisDex',
  description:
    'SwisDex AI trading engine analyses thousands of market signals per second and executes high-frequency trades 24/7 — verified 90% accuracy across forex and crypto.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
