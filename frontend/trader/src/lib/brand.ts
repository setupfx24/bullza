/**
 * Brand constants — single source of truth for white-label values.
 *
 * Set the NEXT_PUBLIC_BRAND_* variables in .env to rebrand the whole app.
 * They are inlined at build time, so in Docker they must be passed as
 * build args (see docker-compose.yml comments), not runtime environment.
 */

/** Product / company display name. */
export const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME || 'YourBrand';

/** Lowercase machine-safe slug (storage keys, ids). */
export const BRAND_SLUG = process.env.NEXT_PUBLIC_BRAND_SLUG || 'yourbrand';

/** Public web domain (no scheme), e.g. "example.com". */
export const BRAND_DOMAIN = process.env.NEXT_PUBLIC_BRAND_DOMAIN || 'example.com';

/**
 * Logo image path. Empty string means "no image logo" — components fall
 * back to the styled <BrandWordmark /> text so a fresh white-label build
 * never ships the previous brand's artwork.
 */
export const BRAND_LOGO = process.env.NEXT_PUBLIC_BRAND_LOGO || '';

/** Support inbox shown across the site. */
export const BRAND_SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_BRAND_SUPPORT_EMAIL || `support@${BRAND_DOMAIN}`;

export const BRAND_COPYRIGHT = `${BRAND_NAME} © ${new Date().getFullYear()}. All rights reserved.`;

/** Zustand persist key for UI preferences (theme, terminal layout). */
export const STORAGE_KEY_UI = 'trader-ui';
