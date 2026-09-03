'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Image half of the split auth layout, shared by /auth/login and
 * /auth/register so the two pages cannot drift apart.
 *
 * It replaces the animated gradient + mandala panel that used to carry the
 * page title and a two-step "1 Sign in / 2 Sign up" list. Those moved into
 * the form column: over a photograph the text needed a scrim to stay
 * legible, and the step list was really just a link to the sibling page.
 *
 * The artwork is a portrait 2:3 asset, cut for this panel specifically.
 * The panel is a tall half-width column with object-fit: cover, so a
 * landscape source (the previous one was the 2.04:1 home banner) lost most
 * of its frame to the crop.
 */
export function AuthLeftPanel() {
  return (
    <div className="auth-left">
      {/* Back to the marketing site. A real <Link> rather than a
          router.push handler so it middle-clicks and opens in a new tab
          like any other link. */}
      <Link href="/" className="auth-back" aria-label="Back to home">
        <ArrowLeft className="w-5 h-5" aria-hidden />
      </Link>

      <Image
        src="/images/login_image.png"
        alt={`Trader wearing a VR headset above a city skyline — ${BRAND_NAME}`}
        fill
        priority
        sizes="(max-width: 768px) 100vw, 50vw"
        className="auth-left__image"
      />
    </div>
  );
}

export default AuthLeftPanel;
