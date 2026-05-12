import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ICO & Early-Stage Investments — Coming Soon | SwisDex',
  description:
    'Early access to vetted blockchain projects, launching soon on SwisDex. Join the early-access list to be notified the moment the first ICO drops.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
