'use client';

import { useEffect } from 'react';

/**
 * Loads Google Translate **after** React hydration to prevent the
 * `.skiptranslate.goog-te-gadget` div from being injected into <body>
 * before React can reconcile the DOM (which causes a hydration mismatch).
 */
export default function GoogleTranslate() {
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

  return <div id="google_translate_element" aria-hidden="true" style={{ display: 'none' }} />;
}
