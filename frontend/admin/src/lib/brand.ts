/**
 * Brand constants — single source of truth for white-label values.
 *
 * Set the NEXT_PUBLIC_BRAND_* variables in .env to rebrand the admin panel.
 * They are inlined at build time, so in Docker they must be passed as
 * build args (see docker-compose.yml comments), not runtime environment.
 */

/** Product / company display name. */
export const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME || 'YourBrand';

/**
 * Logo image path. Empty string means "no image logo" — layout components
 * fall back to styled brand text so a fresh white-label build never ships
 * the previous brand's artwork.
 */
export const BRAND_LOGO = process.env.NEXT_PUBLIC_BRAND_LOGO || '';

export const BRAND_COPYRIGHT = `${BRAND_NAME} © ${new Date().getFullYear()}. All rights reserved.`;
