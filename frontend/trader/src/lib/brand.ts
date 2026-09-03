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
 * Marketing-site artwork, in the two tones the site actually needs.
 * The header sits on the white canvas so it takes the ink mark; the
 * footer bands are solid black so they take the reversed one. Both are
 * overridable for a white-label build, same as BRAND_LOGO.
 */
export const BRAND_LOGO_DARK =
  process.env.NEXT_PUBLIC_BRAND_LOGO_DARK || '/images/logo.png';

export const BRAND_LOGO_LIGHT =
  process.env.NEXT_PUBLIC_BRAND_LOGO_LIGHT || '/images/logo1.png';

/** Support inbox shown across the site. */
export const BRAND_SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_BRAND_SUPPORT_EMAIL || `support@${BRAND_DOMAIN}`;

export const BRAND_COPYRIGHT = `${BRAND_NAME} © ${new Date().getFullYear()}. All rights reserved.`;

/** Zustand persist key for UI preferences (theme, terminal layout). */
export const STORAGE_KEY_UI = 'trader-ui';
