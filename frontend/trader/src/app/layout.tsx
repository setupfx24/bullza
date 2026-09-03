import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '@/components/ThemeProvider';
import NumberInputWheelGuard from '@/components/util/NumberInputWheelGuard';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import { AuthProvider } from '@/components/providers/AuthProvider';
import GoogleAuthProvider from '@/components/providers/GoogleAuthProvider';
import NotificationListener from '@/components/NotificationListener';
import ProfileCompleteGate from '@/components/profile/ProfileCompleteGate';
import TopLoader from '@/components/TopLoader';
import GoogleTranslate from '@/components/GoogleTranslate';
import SplashScreen from '@/components/SplashScreen';
import { CookieConsent } from '@/home/components/CookieConsent';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: BRAND_NAME,
  description: `${BRAND_NAME} — professional forex and CFD trading platform`,
  /* Favicons are served via Next.js file conventions:
     src/app/icon.png and src/app/apple-icon.png. Adding manual
     metadata.icons here would override that — leave them out.

     Both, plus public/favicon.ico and the two public/icons PWA sizes, are
     generated from public/images/fevicon.png — the Bullza bull mark. That
     source is white art on transparency, so every generated icon composites
     it onto the #0a0a0a ink plate the manifest already uses: untouched, the
     mark is invisible against a light tab strip and iOS would flatten the
     alpha to black anyway. Regenerate all five together from that source. */
  // PWA: the manifest (src/app/manifest.ts) is auto-linked by Next.
  applicationName: BRAND_NAME,
  // iOS reads these, NOT the manifest — this is what makes "Add to Home
  // Screen" open the app FULL-SCREEN (standalone) with its own title/icon
  // instead of inside Safari. apple-icon.png supplies the home-screen icon.
  appleWebApp: {
    capable: true,
    title: BRAND_NAME,
    // 'default' = a solid status bar with content BELOW it. Deliberately not
    // 'black-translucent': that flows content under the notch, and only the
    // terminal pads for safe-area-inset-top — other pages (dashboard, wallet)
    // would clip. 'default' renders every page correctly with no safe-area work.
    statusBarStyle: 'default',
  },
  other: {
    // Next 15 emits the modern `mobile-web-app-capable`, but iPhones on
    // iOS < 16.4 only honour the legacy tag for full-screen standalone.
    // Emit both so Add-to-Home-Screen goes full-screen on every iOS version.
    'apple-mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#edece7',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var L='trader-ui',N='trader-ui';var o=localStorage.getItem(L),n=localStorage.getItem(N);if(o&&!n){localStorage.setItem(N,o);localStorage.removeItem(L);}var s=localStorage.getItem(N);var t='light';if(s){var j=JSON.parse(s);t=(j&&j.state&&j.state.theme)||(j&&j.theme)||'light';}var d=document.documentElement;d.setAttribute('data-theme',t);d.classList.add(t==='light'?'theme-light':'theme-dark');if(t==='light'){d.style.backgroundColor='#f4f3ef';d.style.color='#111827';}else{d.style.backgroundColor='#000000';d.style.color='#ffffff';}}catch(e){document.documentElement.setAttribute('data-theme','light');document.documentElement.style.backgroundColor='#ffffff';document.documentElement.style.color='#111827';}})();`,
          }}
        />

      </head>
      <body className="min-h-full" suppressHydrationWarning>
        {/* Branded splash — full-page logo overlay that fades on first paint
            of every full page load / refresh. Client component; auto-unmounts
            after ~650 ms so it never blocks clicks. */}
        <SplashScreen />
        {/* GDPR-style cookie banner + settings modal. Shows once on first
            visit; preferences persist in localStorage. Re-open the modal
            via openCookieSettings() exported from the same component. */}
        <CookieConsent />
        {/* Google Translate — loaded client-side after hydration to avoid DOM mismatch */}
        <GoogleTranslate />
        <Suspense fallback={null}>
          <TopLoader />
        </Suspense>
        <ThemeProvider>
          <AuthProvider>
            <GoogleAuthProvider>
            <NotificationListener />
            <ProfileCompleteGate />
            <NumberInputWheelGuard />
            {children}
            <Suspense fallback={null}>
              <MobileBottomNav />
            </Suspense>
            <Toaster
              position="top-center"
              containerClassName="brand-toaster"
              gutter={10}
              // Drop the stack below the sticky app header (~64px) so toasts
              // don't overlap the Bonus / Affiliates / wallet pills up top.
              containerStyle={{ top: 76, zIndex: 99999 }}
              toastOptions={{
                duration: 2500,
                className: 'brand-hot-toast',
                style: {
                  background: 'var(--toast-bg)',
                  color: 'var(--toast-fg)',
                  border: '1px solid var(--toast-border)',
                },
                success: {
                  duration: 2200,
                  className: 'brand-hot-toast',
                  // White check on a gold disc reads as "good" instantly on
                  // dark surface without losing the brand accent.
                  iconTheme: { primary: '#E85D3D', secondary: '#1a1408' },
                },
                error: {
                  duration: 4000,
                  className: 'brand-hot-toast',
                  // White X on a saturated red disc — high contrast on the
                  // dark toast background, no fade-out into the BG colour.
                  iconTheme: { primary: '#ef4444', secondary: '#ffffff' },
                },
                loading: {
                  duration: Infinity,
                  className: 'brand-hot-toast',
                  iconTheme: { primary: '#E85D3D', secondary: 'var(--toast-bg)' },
                },
              }}
            />
            </GoogleAuthProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
