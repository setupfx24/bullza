import React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ThemeInitScript from '@/components/ThemeInitScript';
import AppToaster from '@/components/AppToaster';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SwisDex Admin',
  description: 'SwisDex broker administration panel',
  /* Favicons served via Next.js file convention from app/icon.png +
     app/apple-icon.png — same source files as the trader app, copied
     across so the browser tab shows the SwisDex shield in both
     surfaces (client request 2026-06-01: "admin and user ka same
     favicon hona chahiye"). Don't add a metadata.icons entry here —
     it would override the file-convention discovery. */
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable} style={{ ['--font-jetbrains' as string]: "ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace" }}>
      <body className={`${inter.className} min-h-screen bg-bg-page text-text-primary antialiased`}>
        <ThemeInitScript />
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
