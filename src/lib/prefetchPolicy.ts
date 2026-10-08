/**
 * Pure policy for the client-side page prefetcher (src/scripts/prefetch.ts): which links may be
 * prefetched, when the network allows it, what to prefetch while idle, and the page cache.
 * No DOM access. Must not import ./i18n: the dictionaries (≈ 20 KB each) would land in the
 * browser bundle (see tests/unit/client-imports.test.ts); the locale helpers below are kept in
 * sync with LOCALES by a unit test instead.
 */
import { nextSteps } from './nextStep';

export const HOVER_DELAY_MS = 65;
export const IDLE_START_DELAY_MS = 3000;
export const CACHE_TTL_MS = 90_000;
export const CACHE_MAX_ENTRIES = 24;
export const MAX_IN_FLIGHT = 2;
export const MAX_IDLE_TARGETS = 3;
export const MAX_ASSETS_PER_PAGE = 6;
export const GLOBAL_HIGH_VALUE_PATH = '/contact/';

export const PREFETCH_LOCALES = ['en', 'vi'] as const;
export type PrefetchLang = (typeof PREFETCH_LOCALES)[number];

/** Pages under these first segments are meta-refresh redirect pages (src/lib/legacyRoutes.mjs). */
const LEGACY_SEGMENTS: readonly string[] = ['services', 'case-studies'];

/** '/vi/solutions/soc/' -> '/solutions/soc/', '/en/' -> '/'. Paths without a locale are returned as is. */
export function stripLangPrefix(pathname: string): string {
  for (const lang of PREFETCH_LOCALES) {
    if (pathname === `/${lang}`) return '/';
    if (pathname.startsWith(`/${lang}/`)) return pathname.slice(lang.length + 1);
  }
  return pathname;
}

/** Localised page path with a trailing slash; query and hash are dropped. */
export function withLang(lang: PrefetchLang, path: string): string {
  const bare = path.split(/[?#]/, 1)[0] ?? '';
  const rooted = bare.startsWith('/') ? bare : `/${bare}`;
  const slashed = rooted.endsWith('/') ? rooted : `${rooted}/`;
  return `/${lang}${slashed}`;
}

/** Reads <html lang>; anything that is not Vietnamese is English (the default locale). */
export function langOf(htmlLang: string | null | undefined): PrefetchLang {
  return htmlLang?.toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

function hasFileExtension(pathname: string): boolean {
  const last = pathname.split('/').pop() ?? '';
  return last.includes('.');
}

/**
 * Cache key / request URL of a page: origin + pathname with a trailing slash on extensionless paths.
 * Query and hash are dropped (the site is static, so they never change the HTML).
 */
export function normalizePageUrl(href: string, base: string): string | null {
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  let pathname = url.pathname.replace(/\/{2,}/g, '/');
  if (!hasFileExtension(pathname) && !pathname.endsWith('/')) pathname += '/';
  return url.origin + pathname;
}

export interface LinkInfo {
  href: string;
  target?: string | null;
  hasDownload?: boolean;
  /** data-astro-reload: the link forces a full page load (e.g. the language switch). */
  reload?: boolean;
  /** data-no-prefetch */
  noPrefetch?: boolean;
  rel?: string | null;
}

export interface EligibilityContext {
  origin: string;
  currentUrl: string;
}

export type SkipReason =
  | 'invalid'
  | 'protocol'
  | 'cross-origin'
  | 'hash-only'
  | 'same-page'
  | 'target'
  | 'download'
  | 'reload'
  | 'no-prefetch'
  | 'external'
  | 'file'
  | 'not-built'
  | 'legacy-redirect';

export type Eligibility = { ok: true; url: string } | { ok: false; reason: SkipReason };

export function eligibility(link: LinkInfo, ctx: EligibilityContext): Eligibility {
  const href = link.href.trim();
  if (href === '') return { ok: false, reason: 'invalid' };
  let url: URL;
  try {
    url = new URL(href, ctx.currentUrl);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    return { ok: false, reason: 'protocol' };
  if (url.origin !== ctx.origin) return { ok: false, reason: 'cross-origin' };

  if (link.hasDownload) return { ok: false, reason: 'download' };
  if (link.reload) return { ok: false, reason: 'reload' };
  if (link.noPrefetch) return { ok: false, reason: 'no-prefetch' };
  if (link.target && link.target !== '_self') return { ok: false, reason: 'target' };
  if (link.rel?.toLowerCase().split(/\s+/).includes('external'))
    return { ok: false, reason: 'external' };

  if (href.startsWith('#')) return { ok: false, reason: 'hash-only' };
  const target = normalizePageUrl(href, ctx.currentUrl);
  if (target === null) return { ok: false, reason: 'invalid' };
  if (target === normalizePageUrl(ctx.currentUrl, ctx.currentUrl))
    return { ok: false, reason: 'same-page' };

  const pathname = new URL(target).pathname;
  if (hasFileExtension(pathname)) return { ok: false, reason: 'file' };
  const [, lang, section] = pathname.split('/');
  if (!(PREFETCH_LOCALES as readonly string[]).includes(lang ?? ''))
    return { ok: false, reason: 'not-built' };
  if (section !== undefined && LEGACY_SEGMENTS.includes(section))
    return { ok: false, reason: 'legacy-redirect' };
  return { ok: true, url: target };
}

export interface NetworkState {
  saveData?: boolean | undefined;
  effectiveType?: string | null | undefined;
  /** (prefers-reduced-data: reduce) */
  reducedData?: boolean | undefined;
  visibility?: string | undefined;
}

/** intent = hover / focus / touch on a link; idle = speculative, after the page has settled. */
export type PrefetchKind = 'intent' | 'idle';

export function mayPrefetch(state: NetworkState, kind: PrefetchKind): boolean {
  if (state.saveData || state.reducedData) return false;
  if (state.visibility === 'hidden') return false;
  const type = state.effectiveType ?? '';
  if (type === 'slow-2g' || type === '2g') return false;
  if (kind === 'idle') return type === '' || type === '4g';
  return true;
}

export interface IdleTargetOptions {
  /** Current pathname including the locale prefix, e.g. '/en/solutions/consulting/'. */
  currentPath: string;
  lang: PrefetchLang;
  /** Normalised page URLs that were already fetched or scheduled. */
  alreadyRequested: ReadonlySet<string>;
  origin: string;
  max?: number;
}

/** The next-step pages of the current page plus the contact page, as absolute normalised URLs. */
export function idleTargets(opts: IdleTargetOptions): string[] {
  const max = Math.min(opts.max ?? MAX_IDLE_TARGETS, MAX_IDLE_TARGETS);
  const current = normalizePageUrl(opts.currentPath, opts.origin);
  const pathname = current === null ? opts.currentPath : new URL(current).pathname;
  const paths = nextSteps(stripLangPrefix(pathname)).map((t) => t.path);
  paths.push(GLOBAL_HIGH_VALUE_PATH);
  const out: string[] = [];
  for (const path of paths) {
    const url = normalizePageUrl(withLang(opts.lang, path), opts.origin);
    if (url === null || url === current) continue;
    if (opts.alreadyRequested.has(url) || out.includes(url)) continue;
    out.push(url);
    if (out.length >= max) break;
  }
  return out;
}

export interface PageCacheOptions {
  ttlMs?: number;
  max?: number;
  now?: () => number;
}

interface Entry<V> {
  value: V;
  storedAt: number;
}

/** Insertion-ordered cache with a TTL and a size bound; the clock is injectable for tests. */
export class PageCache<V = Promise<string>> {
  private readonly entries = new Map<string, Entry<V>>();
  private readonly ttlMs: number;
  private readonly max: number;
  private readonly now: () => number;

  constructor({
    ttlMs = CACHE_TTL_MS,
    max = CACHE_MAX_ENTRIES,
    now = Date.now,
  }: PageCacheOptions = {}) {
    this.ttlMs = ttlMs;
    this.max = max;
    this.now = now;
  }

  private expired(entry: Entry<V>): boolean {
    return this.now() - entry.storedAt >= this.ttlMs;
  }

  private purgeExpired(): void {
    for (const [key, entry] of this.entries) {
      if (this.expired(entry)) this.entries.delete(key);
    }
  }

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (entry === undefined) return undefined;
    if (this.expired(entry)) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  set(key: string, value: V): void {
    this.entries.delete(key);
    if (this.entries.size >= this.max) this.purgeExpired();
    while (this.entries.size >= this.max) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
    this.entries.set(key, { value, storedAt: this.now() });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    this.purgeExpired();
    return this.entries.size;
  }
}

export interface PageAssets {
  stylesheets: string[];
  scripts: string[];
  fonts: string[];
}

function parseAttributes(source: string): Map<string, string> {
  const attrs = new Map<string, string>();
  const re = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const m of source.matchAll(re)) {
    const name = m[1]!.toLowerCase();
    if (!attrs.has(name)) attrs.set(name, m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
}

function sameOriginUrl(href: string | undefined, base: URL): string | null {
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.origin !== base.origin) return null;
  url.hash = '';
  return url.href;
}

function pushUnique(list: string[], value: string): void {
  if (!list.includes(value)) list.push(value);
}

/** Same-origin render and script dependencies of an HTML document (regex based, no DOM). */
export function extractAssets(html: string, baseUrl: string): PageAssets {
  const assets: PageAssets = { stylesheets: [], scripts: [], fonts: [] };
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return assets;
  }
  const visible = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, '');

  for (const m of visible.matchAll(/<link\b([^>]*)>/gi)) {
    const attrs = parseAttributes(m[1] ?? '');
    const rels = (attrs.get('rel') ?? '').toLowerCase().split(/\s+/);
    const href = sameOriginUrl(attrs.get('href'), base);
    if (href === null) continue;
    if (rels.includes('stylesheet')) {
      if ((attrs.get('media') ?? '').toLowerCase() !== 'print')
        pushUnique(assets.stylesheets, href);
    } else if (rels.includes('modulepreload')) {
      pushUnique(assets.scripts, href);
    } else if (rels.includes('preload') && (attrs.get('as') ?? '').toLowerCase() === 'font') {
      pushUnique(assets.fonts, href);
    }
  }

  for (const m of visible.matchAll(/<script\b([^>]*)>/gi)) {
    const attrs = parseAttributes(m[1] ?? '');
    if ((attrs.get('type') ?? '').toLowerCase() !== 'module') continue;
    const src = sameOriginUrl(attrs.get('src'), base);
    if (src !== null) pushUnique(assets.scripts, src);
  }
  return assets;
}

export interface AssetHint {
  url: string;
  as: 'style' | 'script' | 'font';
}

/** Assets worth hinting for a prefetched page: unknown ones only, at most MAX_ASSETS_PER_PAGE. */
export function assetsToHint(
  assets: PageAssets,
  known: { has(url: string): boolean },
): AssetHint[] {
  const out: AssetHint[] = [];
  const seen = new Set<string>();
  const add = (urls: string[], as: AssetHint['as']): void => {
    for (const url of urls) {
      if (out.length >= MAX_ASSETS_PER_PAGE) return;
      if (seen.has(url) || known.has(url)) continue;
      seen.add(url);
      out.push({ url, as });
    }
  };
  add(assets.stylesheets, 'style');
  add(assets.scripts, 'script');
  add(assets.fonts, 'font');
  return out;
}
