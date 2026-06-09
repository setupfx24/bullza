'use client';

import { useEffect } from 'react';

/**
 * Loads Google Translate **after** React hydration to prevent the
 * `.skiptranslate.goog-te-gadget` div from being injected into <body>
 * before React can reconcile the DOM (which causes a hydration mismatch).
 *
 * Sets the saved language once on mount. Google's MutationObserver then
 * handles all subsequent route changes automatically — re-firing on
 * navigation caused a visible English-to-translated flash.
 */
export default function GoogleTranslate() {

  useEffect(() => {
    // Skip if already loaded (HMR / StrictMode double-mount)
    if (document.getElementById('google-translate-script')) return;

    // 1. Define the init callback Google Translate expects.
    //
    // Must include every code the LanguageSwitcher offers — Google
    // silently no-ops when the user picks a language outside this list,
    // so the picker UI worked but nothing actually translated for the
    // missing ones. List is kept in sync with LanguageSwitcher.LANGUAGES.
    (window as any).googleTranslateElementInit = () => {
      new (window as any).google.translate.TranslateElement(
        {
          pageLanguage: 'en',
          includedLanguages:
            'en,ms,zh-CN,zh-TW,el,hu,ru,id,fr,it,sv,de,pl,ar,es,ko,pt,vi,'
            + 'th,fil,nl,cs,bn,ur,tr,hi,si,uz,mn,ja,ta,te,mr,gu,pa,fa,iw,'
            + 'uk,ro,no,da,fi,sw',
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

  // On first mount only — if the cookie says the user picked a non-English
  // language, set the hidden select to that value once Google's widget
  // finishes loading. Google's MutationObserver then handles translation
  // for every subsequent route change automatically — no need to re-fire
  // the change event on navigation (doing so causes a brief English flash).
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
        // Only set + dispatch if the value actually needs to change.
        if (select.value !== target) {
          select.value = target;
          select.dispatchEvent(new Event('change'));
        }
        window.clearInterval(id);
      } else if (attempts >= max) {
        window.clearInterval(id);
      }
    }, 200);

    return () => window.clearInterval(id);
  }, []);

  return <div id="google_translate_element" aria-hidden="true" style={{ display: 'none' }} />;
}
