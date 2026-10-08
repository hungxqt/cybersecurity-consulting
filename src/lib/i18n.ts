import enDict from '../i18n/en.json';
import viDict from '../i18n/vi.json';
import { interpolate } from './interpolate';

export { interpolate } from './interpolate';

export const LOCALES = ['en', 'vi'] as const;
export type Lang = (typeof LOCALES)[number];
export const DEFAULT_LANG: Lang = 'en';

export type Dict = Record<string, string>;

export const PLACEHOLDER_PREFIX = '[VI] ';

/** True for blank values and untranslated '[VI] ' placeholders, which must never reach a visitor. */
export const isPlaceholder = (v: unknown): boolean =>
  typeof v !== 'string' ||
  v.trim() === '' ||
  v.startsWith(PLACEHOLDER_PREFIX) ||
  v.trim() === '[VI]';

export const dictionaries: Record<Lang, Dict> = {
  en: enDict as Dict,
  vi: viDict as Dict,
};

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Translate a key. Falls back to English when the target language lacks the key
 * has an empty value or only an untranslated '[VI] ' placeholder; returns the key itself when no dictionary has it.
 */
export function translate(
  dicts: Record<Lang, Dict>,
  lang: Lang,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const value = dicts[lang]?.[key];
  if (typeof value === 'string' && !isPlaceholder(value)) return interpolate(value, vars);
  const fallback = dicts[DEFAULT_LANG]?.[key];
  if (typeof fallback === 'string') return interpolate(fallback, vars);
  return key;
}

export function useT(lang: Lang) {
  return (key: string, vars?: Record<string, string | number>) =>
    translate(dictionaries, lang, key, vars);
}

/** Build a localized, trailing-slash path: localizedPath('vi', '/services') -> '/vi/services/'. */
export function localizedPath(lang: Lang, path = '/'): string {
  const clean = path.replace(/^\/+|\/+$/g, '');
  return clean ? `/${lang}/${clean}/` : `/${lang}/`;
}

/**
 * Like localizedPath, but keeps a '?query' and '#fragment': localizedHref('en', '/contact/?topic=a#x')
 * -> '/en/contact/?topic=a#x'.
 */
export function localizedHref(lang: Lang, path = '/'): string {
  const i = path.indexOf('#');
  const noHash = i === -1 ? path : path.slice(0, i);
  const hash = i === -1 ? '' : path.slice(i + 1);
  const q = noHash.indexOf('?');
  const base = q === -1 ? noHash : noHash.slice(0, q);
  const query = q === -1 ? '' : noHash.slice(q + 1);
  return localizedPath(lang, base) + (query ? `?${query}` : '') + (hash ? `#${hash}` : '');
}

/** Swap the language segment of the current pathname, keeping the rest of the page. */
export function switchLocalePath(pathname: string, target: Lang): string {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length > 0 && isLang(parts[0])) parts.shift();
  return localizedPath(target, parts.join('/'));
}

/** Strip the language segment: '/vi/services/soc/' -> '/services/soc/'. */
export function stripLocale(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length > 0 && isLang(parts[0])) parts.shift();
  return parts.length ? `/${parts.join('/')}/` : '/';
}
