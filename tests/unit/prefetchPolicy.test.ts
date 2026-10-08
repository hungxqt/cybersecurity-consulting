import { describe, expect, it } from 'vitest';
import { LOCALES } from '@/lib/i18n';
import { LEGACY } from '@/lib/legacyRoutes.mjs';
import {
  CACHE_MAX_ENTRIES,
  CACHE_TTL_MS,
  GLOBAL_HIGH_VALUE_PATH,
  HOVER_DELAY_MS,
  IDLE_START_DELAY_MS,
  MAX_ASSETS_PER_PAGE,
  MAX_IDLE_TARGETS,
  MAX_IN_FLIGHT,
  PREFETCH_LOCALES,
  PageCache,
  assetsToHint,
  eligibility,
  extractAssets,
  idleTargets,
  langOf,
  mayPrefetch,
  normalizePageUrl,
  stripLangPrefix,
  withLang,
  type LinkInfo,
  type NetworkState,
  type SkipReason,
} from '@/lib/prefetchPolicy';

const ORIGIN = 'https://hungtran.id.vn';
const CURRENT = `${ORIGIN}/en/solutions/`;
const ctx = { origin: ORIGIN, currentUrl: CURRENT };

describe('constants', () => {
  it('match the agreed policy', () => {
    expect(HOVER_DELAY_MS).toBe(65);
    expect(IDLE_START_DELAY_MS).toBe(3000);
    expect(MAX_IN_FLIGHT).toBe(2);
    expect(MAX_IDLE_TARGETS).toBe(3);
    expect(MAX_ASSETS_PER_PAGE).toBe(6);
    expect(GLOBAL_HIGH_VALUE_PATH).toBe('/contact/');
    expect(CACHE_MAX_ENTRIES).toBe(24);
    expect(CACHE_TTL_MS).toBeGreaterThanOrEqual(60_000);
    expect(CACHE_TTL_MS).toBeLessThanOrEqual(120_000);
  });
});

describe('eligibility', () => {
  const eligible: [string, LinkInfo, string][] = [
    ['plain page', { href: '/en/about/' }, `${ORIGIN}/en/about/`],
    [
      'query dropped, other locale',
      { href: '/vi/contact/?topic=consulting' },
      `${ORIGIN}/vi/contact/`,
    ],
    ['absolute same-origin', { href: `${ORIGIN}/en/blog/` }, `${ORIGIN}/en/blog/`],
    ['missing trailing slash', { href: '/en/blog' }, `${ORIGIN}/en/blog/`],
    ['hash on another page', { href: '/en/about/#team' }, `${ORIGIN}/en/about/`],
    ['target _self', { href: '/en/about/', target: '_self' }, `${ORIGIN}/en/about/`],
    ['rel without external', { href: '/en/about/', rel: 'noopener' }, `${ORIGIN}/en/about/`],
  ];
  it.each(eligible)('accepts %s', (_name, link, url) => {
    expect(eligibility(link, ctx)).toEqual({ ok: true, url });
  });

  const skipped: [string, LinkInfo, SkipReason][] = [
    ['hash only', { href: '#faq' }, 'hash-only'],
    ['same page with hash', { href: '/en/solutions/#x' }, 'same-page'],
    ['same page without slash', { href: '/en/solutions' }, 'same-page'],
    ['same page with query', { href: '/en/solutions/?a=1' }, 'same-page'],
    ['target _blank', { href: '/en/about/', target: '_blank' }, 'target'],
    ['download', { href: '/en/about/', hasDownload: true }, 'download'],
    ['data-astro-reload (language switch)', { href: '/vi/solutions/', reload: true }, 'reload'],
    ['data-no-prefetch', { href: '/en/about/', noPrefetch: true }, 'no-prefetch'],
    ['rel external', { href: '/en/about/', rel: 'external noopener' }, 'external'],
    ['mailto', { href: 'mailto:a@b.c' }, 'protocol'],
    ['tel', { href: 'tel:+84' }, 'protocol'],
    ['javascript', { href: 'javascript:void(0)' }, 'protocol'],
    ['data url', { href: 'data:text/html,hi' }, 'protocol'],
    ['other https origin', { href: 'https://example.com/en/' }, 'cross-origin'],
    ['other http origin', { href: 'http://other.test/' }, 'cross-origin'],
    ['security.txt', { href: '/.well-known/security.txt' }, 'file'],
    ['sitemap', { href: '/sitemap-0.xml' }, 'file'],
    ['og image', { href: '/og/en.png' }, 'file'],
    ['favicon', { href: '/favicon.svg' }, 'file'],
    ['robots', { href: '/robots.txt' }, 'file'],
    ['built asset', { href: '/_astro/x.js' }, 'file'],
    ['root redirect', { href: '/' }, 'not-built'],
    ['unknown section', { href: '/foo/' }, 'not-built'],
    ['legacy services', { href: '/en/services/soc/' }, 'legacy-redirect'],
    ['legacy case studies', { href: '/vi/case-studies/' }, 'legacy-redirect'],
    ['empty', { href: '' }, 'invalid'],
    ['garbage', { href: 'http://' }, 'invalid'],
  ];
  it.each(skipped)('skips %s', (_name, link, reason) => {
    expect(eligibility(link, ctx)).toEqual({ ok: false, reason });
  });

  it('rejects every legacy redirect page (with and without trailing slash)', () => {
    for (const [from] of LEGACY) {
      expect(eligibility({ href: from }, ctx)).toEqual({ ok: false, reason: 'legacy-redirect' });
      expect(eligibility({ href: from.replace(/\/$/, '') }, ctx)).toEqual({
        ok: false,
        reason: 'legacy-redirect',
      });
    }
  });
});

describe('normalizePageUrl', () => {
  it.each([
    ['/en/about', `${ORIGIN}/en/about/`],
    ['/en/about/?x=1#y', `${ORIGIN}/en/about/`],
    ['/en//about/', `${ORIGIN}/en/about/`],
    ['/sitemap-0.xml', `${ORIGIN}/sitemap-0.xml`],
    ['mailto:a@b.c', null],
    ['javascript:void(0)', null],
    ['http://', null],
  ])('%s -> %s', (href, expected) => {
    expect(normalizePageUrl(href, CURRENT)).toBe(expected);
  });

  it('keeps the origin of absolute URLs and resolves relative ones', () => {
    expect(normalizePageUrl('https://other.test/a', CURRENT)).toBe('https://other.test/a/');
    expect(normalizePageUrl('../about', CURRENT)).toBe(`${ORIGIN}/en/about/`);
  });
});

describe('locale helpers', () => {
  it('keeps PREFETCH_LOCALES in sync with LOCALES', () => {
    expect([...PREFETCH_LOCALES]).toEqual([...LOCALES]);
  });

  it.each([
    ['/vi/solutions/soc/', '/solutions/soc/'],
    ['/en/', '/'],
    ['/en', '/'],
    ['/english/', '/english/'],
    ['/contact/', '/contact/'],
  ])('stripLangPrefix(%s) = %s', (input, expected) => {
    expect(stripLangPrefix(input)).toBe(expected);
  });

  it.each([
    ['en', '/contact/?topic=consulting', '/en/contact/'],
    ['vi', '/solutions/soc/', '/vi/solutions/soc/'],
    ['en', '/', '/en/'],
    ['en', 'about#team', '/en/about/'],
  ] as const)('withLang(%s, %s) = %s', (lang, path, expected) => {
    expect(withLang(lang, path)).toBe(expected);
  });

  it.each([
    ['vi', 'vi'],
    ['vi-VN', 'vi'],
    ['en', 'en'],
    ['fr', 'en'],
    ['', 'en'],
    [null, 'en'],
    [undefined, 'en'],
  ] as const)('langOf(%s) = %s', (input, expected) => {
    expect(langOf(input)).toBe(expected);
  });
});

describe('mayPrefetch', () => {
  const cases: [string, NetworkState, boolean, boolean][] = [
    ['unknown connection', {}, true, true],
    ['4g', { effectiveType: '4g' }, true, true],
    ['empty effectiveType', { effectiveType: '' }, true, true],
    ['3g', { effectiveType: '3g' }, true, false],
    ['2g', { effectiveType: '2g' }, false, false],
    ['slow-2g', { effectiveType: 'slow-2g' }, false, false],
    ['saveData', { saveData: true, effectiveType: '4g' }, false, false],
    ['reduced data', { reducedData: true }, false, false],
    ['hidden tab', { visibility: 'hidden' }, false, false],
    ['visible tab', { visibility: 'visible' }, true, true],
  ];
  it.each(cases)('%s -> intent %s, idle %s', (_name, state, intent, idle) => {
    expect(mayPrefetch(state, 'intent')).toBe(intent);
    expect(mayPrefetch(state, 'idle')).toBe(idle);
  });
});

describe('idleTargets', () => {
  const base = { origin: ORIGIN, alreadyRequested: new Set<string>() };
  const u = (path: string): string => `${ORIGIN}${path}`;

  it('returns next steps plus the contact page', () => {
    expect(idleTargets({ ...base, currentPath: '/en/solutions/consulting/', lang: 'en' })).toEqual([
      u('/en/solutions/audit/'),
      u('/en/experience/'),
      u('/en/contact/'),
    ]);
  });

  it('never returns more than three targets or the current page', () => {
    const paths = [
      '/en/',
      '/en/solutions/',
      '/en/solutions/consulting/',
      '/en/solutions/audit/',
      '/en/solutions/soc/',
      '/en/experience/',
      '/en/blog/',
      '/en/blog/some-post/',
      '/en/resources/',
      '/en/about/',
      '/en/careers/',
      '/en/contact/',
      '/en/security/',
      '/vi/contact/',
      '/vi/',
    ];
    for (const currentPath of paths) {
      const lang = currentPath.startsWith('/vi/') ? 'vi' : 'en';
      const out = idleTargets({ ...base, currentPath, lang });
      expect(out.length).toBeGreaterThan(0);
      expect(out.length).toBeLessThanOrEqual(3);
      expect(out).not.toContain(u(currentPath));
      expect(new Set(out).size).toBe(out.length);
      for (const url of out) expect(url.startsWith(u(`/${lang}/`))).toBe(true);
    }
  });

  it('does not append the contact page when it is the current page', () => {
    const out = idleTargets({ ...base, currentPath: '/en/contact/', lang: 'en' });
    expect(out).toEqual([u('/en/resources/'), u('/en/experience/')]);
  });

  it('does not duplicate the contact page when it is already a next step', () => {
    const out = idleTargets({ ...base, currentPath: '/en/solutions/soc/', lang: 'en' });
    expect(out).toEqual([u('/en/resources/'), u('/en/contact/')]);
  });

  it('excludes pages that were already requested', () => {
    const out = idleTargets({
      ...base,
      alreadyRequested: new Set([u('/en/experience/')]),
      currentPath: '/en/solutions/consulting/',
      lang: 'en',
    });
    expect(out).toEqual([u('/en/solutions/audit/'), u('/en/contact/')]);
  });

  it('strips the ?topic query of the review target', () => {
    const out = idleTargets({ ...base, currentPath: '/en/resources/', lang: 'en' });
    expect(out[0]).toBe(u('/en/contact/'));
    expect(out.some((url) => url.includes('?'))).toBe(false);
  });

  it('localises Vietnamese pages and accepts a missing trailing slash', () => {
    expect(idleTargets({ ...base, currentPath: '/vi/solutions/consulting', lang: 'vi' })).toEqual([
      u('/vi/solutions/audit/'),
      u('/vi/experience/'),
      u('/vi/contact/'),
    ]);
  });

  it('honours a smaller max', () => {
    expect(idleTargets({ ...base, currentPath: '/en/', lang: 'en', max: 1 })).toEqual([
      u('/en/experience/'),
    ]);
  });
});

describe('PageCache', () => {
  function clocked(options: { ttlMs?: number; max?: number } = {}) {
    let now = 1_000;
    const cache = new PageCache<string>({ ...options, now: () => now });
    return {
      cache,
      advance(ms: number) {
        now += ms;
      },
    };
  }

  it('hits before the TTL and misses (and deletes) after it', () => {
    const { cache, advance } = clocked({ ttlMs: 100 });
    cache.set('a', 'A');
    advance(99);
    expect(cache.get('a')).toBe('A');
    expect(cache.has('a')).toBe(true);
    advance(1);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.has('a')).toBe(false);
    expect(cache.size).toBe(0);
  });

  it('resets the TTL when an entry is overwritten', () => {
    const { cache, advance } = clocked({ ttlMs: 100 });
    cache.set('a', 'A1');
    advance(80);
    cache.set('a', 'A2');
    advance(80);
    expect(cache.get('a')).toBe('A2');
  });

  it('evicts the oldest entry when full', () => {
    const { cache, advance } = clocked({ ttlMs: 1_000, max: 3 });
    for (const key of ['a', 'b', 'c']) {
      cache.set(key, key);
      advance(1);
    }
    cache.set('d', 'd');
    expect(cache.has('a')).toBe(false);
    expect([cache.has('b'), cache.has('c'), cache.has('d')]).toEqual([true, true, true]);
    expect(cache.size).toBe(3);
  });

  it('purges expired entries before evicting live ones', () => {
    const { cache, advance } = clocked({ ttlMs: 100, max: 2 });
    cache.set('old', 'o');
    advance(60);
    cache.set('mid', 'm');
    advance(50);
    cache.set('new', 'n');
    expect(cache.has('old')).toBe(false);
    expect(cache.has('mid')).toBe(true);
    expect(cache.has('new')).toBe(true);
  });

  it('re-setting an existing key at capacity evicts nothing else', () => {
    const { cache } = clocked({ max: 2 });
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('a', '3');
    expect(cache.get('a')).toBe('3');
    expect(cache.get('b')).toBe('2');
  });

  it('supports delete and clear', () => {
    const { cache } = clocked();
    cache.set('a', 'A');
    cache.set('b', 'B');
    cache.delete('a');
    expect(cache.size).toBe(1);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('uses the exported defaults', () => {
    let now = 0;
    const cache = new PageCache<number>({ now: () => now });
    cache.set('a', 1);
    now = CACHE_TTL_MS - 1;
    expect(cache.get('a')).toBe(1);
    now = CACHE_TTL_MS;
    expect(cache.get('a')).toBeUndefined();
    for (let i = 0; i < CACHE_MAX_ENTRIES + 5; i++) cache.set(`k${String(i)}`, i);
    expect(cache.size).toBe(CACHE_MAX_ENTRIES);
  });

  it('stores promises by default', async () => {
    const cache = new PageCache();
    cache.set('a', Promise.resolve('<html>'));
    await expect(cache.get('a')).resolves.toBe('<html>');
  });
});

describe('extractAssets', () => {
  const PAGE = `${ORIGIN}/en/solutions/`;
  // Trimmed from the built dist/en/index.html head.
  const HEAD = [
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">',
    '<link rel="preload" as="font" type="font/woff2" href="/_astro/be-vietnam-pro-latin-300-normal.Y7NOBCwQ.woff2" crossorigin>',
    '<link rel="canonical" href="https://hungtran.id.vn/en/">',
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
    '<meta name="astro-view-transitions-enabled" content="true">',
    '<script type="module" src="/_astro/ClientRouter.astro_astro_type_script_index_0_lang.BDCjmQ8c.js"></script>',
    '<script type="application/ld+json">{"@context":"https://schema.org"}</script>',
    '<link rel="stylesheet" href="/_astro/style.DnAbQDEN.css"></head><body>',
  ].join('');

  it('collects the stylesheet, module scripts and preloaded font of a real head', () => {
    expect(extractAssets(HEAD, PAGE)).toEqual({
      stylesheets: [`${ORIGIN}/_astro/style.DnAbQDEN.css`],
      scripts: [`${ORIGIN}/_astro/ClientRouter.astro_astro_type_script_index_0_lang.BDCjmQ8c.js`],
      fonts: [`${ORIGIN}/_astro/be-vietnam-pro-latin-300-normal.Y7NOBCwQ.woff2`],
    });
  });

  it('handles attribute order, quotes and modulepreload', () => {
    const html =
      "<link href='/a.css' rel='stylesheet'>" +
      '<link crossorigin as="font" href="/f.woff2" rel="preload" type="font/woff2">' +
      '<script src=/m.js type=module></script>' +
      '<link rel="modulepreload" href="/chunk.js">';
    expect(extractAssets(html, PAGE)).toEqual({
      stylesheets: [`${ORIGIN}/a.css`],
      scripts: [`${ORIGIN}/chunk.js`, `${ORIGIN}/m.js`],
      fonts: [`${ORIGIN}/f.woff2`],
    });
  });

  it('skips print stylesheets, classic scripts, other origins and data URLs', () => {
    const html =
      '<link rel="stylesheet" href="/print.css" media="print">' +
      '<script src="/classic.js"></script>' +
      '<link rel="stylesheet" href="https://cdn.test/x.css">' +
      '<link rel="stylesheet" href="data:text/css,a{}">' +
      '<script type="module" src="//evil.test/x.js"></script>' +
      '<link rel="preload" as="image" href="/hero.png">';
    expect(extractAssets(html, PAGE)).toEqual({ stylesheets: [], scripts: [], fonts: [] });
  });

  it('removes duplicates, drops hashes and ignores noscript and comments', () => {
    const html =
      '<link rel="stylesheet" href="/a.css"><link rel="stylesheet" href="/a.css#x">' +
      '<noscript><link rel="stylesheet" href="/noscript.css"></noscript>' +
      '<!-- <link rel="stylesheet" href="/commented.css"> -->';
    expect(extractAssets(html, PAGE).stylesheets).toEqual([`${ORIGIN}/a.css`]);
  });

  it('returns nothing for an unparsable base URL', () => {
    expect(extractAssets(HEAD, 'not a url')).toEqual({ stylesheets: [], scripts: [], fonts: [] });
  });
});

describe('assetsToHint', () => {
  const assets = {
    stylesheets: [`${ORIGIN}/a.css`],
    scripts: [`${ORIGIN}/a.js`, `${ORIGIN}/b.js`],
    fonts: [`${ORIGIN}/f.woff2`],
  };

  it('hints only unknown assets, with their type', () => {
    const known = new Set([`${ORIGIN}/a.css`, `${ORIGIN}/f.woff2`]);
    expect(assetsToHint(assets, known)).toEqual([
      { url: `${ORIGIN}/a.js`, as: 'script' },
      { url: `${ORIGIN}/b.js`, as: 'script' },
    ]);
  });

  it('returns styles, scripts, fonts in that order and de-duplicates across kinds', () => {
    const out = assetsToHint(
      { stylesheets: [`${ORIGIN}/x`], scripts: [`${ORIGIN}/x`], fonts: [`${ORIGIN}/f`] },
      new Set(),
    );
    expect(out).toEqual([
      { url: `${ORIGIN}/x`, as: 'style' },
      { url: `${ORIGIN}/f`, as: 'font' },
    ]);
  });

  it('caps the number of hints', () => {
    const many = {
      stylesheets: [],
      scripts: Array.from({ length: 20 }, (_, i) => `${ORIGIN}/${String(i)}.js`),
      fonts: [],
    };
    expect(assetsToHint(many, new Set())).toHaveLength(MAX_ASSETS_PER_PAGE);
  });
});
