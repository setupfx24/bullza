import type { MetadataRoute } from 'next';
import { BRAND_NAME } from '@/lib/brand';

// Web App Manifest — makes the trader app installable as a PWA.
// Next serves this at /manifest.webmanifest and auto-links it from <head>.
// `display: standalone` opens the installed app full-screen (no browser bars);
// iOS full-screen is driven separately by the appleWebApp meta in layout.tsx.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND_NAME} — Trading Platform`,
    short_name: BRAND_NAME,
    description: `${BRAND_NAME} — professional forex and CFD trading platform`,
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Same art also declared maskable so Android's adaptive mask uses it
      // rather than boxing the icon on a white plate.
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
