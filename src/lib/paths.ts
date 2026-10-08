import { LOCALES } from './i18n';

/** getStaticPaths helper for pages under src/pages/[lang]/. */
export function langStaticPaths() {
  return LOCALES.map((lang) => ({ params: { lang } }));
}
