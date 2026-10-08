/** Site-wide settings. See the README checklist before going live. */
export const CONTACT_EMAIL = 'info@hungtran.id.vn';
export const SECURITY_EMAIL = 'security@hungtran.id.vn';

/** Shown on /security/. Update when the disclosure policy changes. */
export const SECURITY_POLICY_UPDATED = new Date('2026-10-08T00:00:00Z');

/**
 * Formspree form id, set with PUBLIC_FORMSPREE_ID at build time (Cloudflare Pages env var).
 * Without it the form shows a "not configured" message instead of failing silently.
 */
export const FORMSPREE_ID: string =
  (import.meta.env.PUBLIC_FORMSPREE_ID as string | undefined) ?? 'REPLACE_ME';
export const FORMSPREE_ENDPOINT = `https://formspree.io/f/${FORMSPREE_ID}`;
