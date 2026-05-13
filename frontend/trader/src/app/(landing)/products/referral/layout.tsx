import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Referral Program | SwisDex',
  description: 'SwisDex referral program — share your link, earn rewards on every funded friend.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
