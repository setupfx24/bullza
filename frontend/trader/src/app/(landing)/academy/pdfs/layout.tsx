import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SwisDex Academy — Downloadable PDFs, Guides & Reports',
  description: 'Free trading guides, e-books, and quarterly market reports — download and read offline. New releases monthly.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
