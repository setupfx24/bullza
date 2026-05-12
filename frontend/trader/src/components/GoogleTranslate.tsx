'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Loads Google Translate **after** React hydration to prevent the
 * `.skiptranslate.goog-te-gadget` div from being injected into <body>
 * before React can reconcile the DOM (which causes a hydration mismatch).
 *
 * Also re-applies the user's saved language on every client-side route
 * change. Next.js navigates without a full page reload, so Google's
 * mutation observer can miss freshly-mounted content unless we nudge it
 * to re-translate.
 */
export default function GoogleTranslate() {
  const pathname = usePathname();

  useEffect(() => {
    // Skip if already loaded (HMR / StrictMode double-mount)
    if (document.getElementById('google-translate-script')) return;

    // 1. Define the init callback Google Translate expects.
    (window as any).googleTranslateElementInit = () => {
      new (window as any).google.translate.TranslateElement(
        {
          pageLanguage: 'en',
          includedLanguages:
            'en,ms,zh-CN,zh-TW,el,hu,ru,id,fr,it,sv,de,pl,ar,es,ko,pt,vi,th,fil,nl,cs,bn,ur,tr,hi,si,uz,mn',
          autoDisplay: false,
        },
        'google_translate_element',
      );
    };

    // 2. Inject the script tag dynamically.
    const script = document.createElement('script');
    script.id = 'google-translate-script';
    script.src =
      'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    document.head.appendChild(script);
  }, []);

  // After every route change, if the user has a non-English language selected,
  // re-fire the hidden `.goog-te-combo` so Google retranslates the freshly
  // mounted DOM. Without this, navigating to a new page on a Next.js SPA
  // leaves the new page in English even though the user picked, say, Hindi.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const m = document.cookie.match(/(?:^|; )googtrans=([^;]+)/);
    if (!m) return;
    const target = decodeURIComponent(m[1]).split('/')[2];
    if (!target || target === 'en') return;

    let attempts = 0;
    const max = 20; // ~4 s total — covers slow GT widget boot
    const id = window.setInterval(() => {
      attempts += 1;
      const select = document.querySelector<HTMLSelectElement>('.goog-te-combo');
      if (select) {
        if (select.value !== target) {
          select.value = target;
          select.dispatchEvent(new Event('change'));
        } else {
          // Re-fire change anyway so GT re-scans the new page's DOM
          select.dispatchEvent(new Event('change'));
        }
        window.clearInterval(id);
      } else if (attempts >= max) {
        window.clearInterval(id);
      }
    }, 200);

    return () => window.clearInterval(id);
  }, [pathname]);

  return <div id="google_translate_element" aria-hidden="true" style={{ display: 'none' }} />;
}
