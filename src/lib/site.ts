/** Site-wide settings. Replace the placeholders before going live (see README). */
export const CONTACT_EMAIL = 'info@hungtran.id.vn';
export const SECURITY_EMAIL = 'security@hungtran.example';

/**
 * Formspree form id, set with PUBLIC_FORMSPREE_ID at build time (Cloudflare Pages env var).
 * The placeholder makes the form show a "not configured" message instead of failing silently.
 */
export const FORMSPREE_ID: string =
  (import.meta.env.PUBLIC_FORMSPREE_ID as string | undefined) ?? 'REPLACE_ME';
export const FORMSPREE_ENDPOINT = `https://formspree.io/f/${FORMSPREE_ID}`;

/**
 * True while the careers pages show sample role descriptions. Set to false once the roles,
 * locations and terms are real (hides the "sample roles" notice).
 */
export const jobsAreSamples = true;
