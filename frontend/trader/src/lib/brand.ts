/**
 * Brand constants — single source of truth for white-label values.
 *
 * Set the NEXT_PUBLIC_BRAND_* variables in .env to rebrand the whole app.
 * They are inlined at build time, so in Docker they must be passed as
 * build args (see docker-compose.yml comments), not runtime environment.
 */

/** Product / company display name. */
export const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME || 'Bullza';

/** Lowercase machine-safe slug (storage keys, ids). */
export const BRAND_SLUG = process.env.NEXT_PUBLIC_BRAND_SLUG || 'bullza';

/** Public web domain (no scheme), e.g. "bullza.com". */
export const BRAND_DOMAIN = process.env.NEXT_PUBLIC_BRAND_DOMAIN || 'bullza.com';

/**
 * Logo image path. Empty string means "no image logo" — components fall
 * back to the styled <BrandWordmark /> text so a fresh white-label build
 * never ships the previous brand's artwork.
 */
export const BRAND_LOGO = process.env.NEXT_PUBLIC_BRAND_LOGO || '';

/**
 * Brand artwork in the two tones every surface needs.
 *
 * Naming is by the MARK's colour, not the surface's: the ink mark is dark
 * artwork and therefore belongs on LIGHT backgrounds (light theme, white
 * header, marketing pages), and the reversed mark is white artwork for
 * DARK backgrounds (dark theme, black footer, splash screen). Getting
 * this backwards renders the logo invisible, so prefer <BrandLogo />,
 * which picks the right one from the active theme for you.
 */
export const BRAND_LOGO_INK =
  process.env.NEXT_PUBLIC_BRAND_LOGO_DARK || '/images/logo.png';

export const BRAND_LOGO_REVERSED =
  process.env.NEXT_PUBLIC_BRAND_LOGO_LIGHT || '/images/logo1.png';

/** Legacy aliases — the marketing site imports these names. */
export const BRAND_LOGO_DARK = BRAND_LOGO_INK;
export const BRAND_LOGO_LIGHT = BRAND_LOGO_REVERSED;

/** Support inbox shown across the site. */
export const BRAND_SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_BRAND_SUPPORT_EMAIL || `support@${BRAND_DOMAIN}`;

export const BRAND_COPYRIGHT = `${BRAND_NAME} © ${new Date().getFullYear()}. All rights reserved.`;

/** Zustand persist key for UI preferences (theme, terminal layout). */
export const STORAGE_KEY_UI = 'trader-ui';
