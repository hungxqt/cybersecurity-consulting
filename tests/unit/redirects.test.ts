import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { LEGACY } from '@/lib/legacyRoutes.mjs';
import { sitemapFilter } from '@/lib/sitemapFilter.mjs';
import { LOCALES } from '@/lib/i18n';

interface Rule {
  from: string;
  to: string;
  status: string;
}

const rules: Rule[] = readFileSync('public/_redirects', 'utf8')
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))
  .map((l) => {
    const [from, to, status] = l.split(/\s+/);
    return { from: from!, to: to!, status: status! };
  });

/** Cloudflare-style match: a trailing "*" is a prefix wildcard; otherwise exact. */
const matches = (rule: Rule, path: string) =>
  rule.from.endsWith('*') ? path.startsWith(rule.from.slice(0, -1)) : rule.from === path;
const isSplat = (rule: Rule) => rule.from.endsWith('*');

const KNOWN_PATHS = [
  '/',
  '/solutions/',
  '/solutions/consulting/',
  '/solutions/audit/',
  '/solutions/soc/',
  '/experience/',
  '/experience/scenarios/logistics-soc-onboarding/',
  '/experience/scenarios/fintech-soc2-readiness/',
  '/experience/scenarios/health-portal-threat-modeling/',
  '/about/',
  '/blog/',
  '/careers/',
  '/resources/',
  '/contact/',
];
const ROUTES = new Set(
  LOCALES.flatMap((l) => KNOWN_PATHS.map((p) => (p === '/' ? `/${l}/` : `/${l}${p}`))),
);

describe('legacy routes', () => {
  it('has 8 pairs per language', () => {
    expect(LEGACY).toHaveLength(16);
  });
  it('every target exists in the route list', () => {
    for (const [, to] of LEGACY) expect(ROUTES.has(to), to).toBe(true);
  });
  it('no target is itself a source', () => {
    const sources = new Set(LEGACY.map(([f]) => f));
    for (const [, to] of LEGACY) expect(sources.has(to), to).toBe(false);
  });
});

describe('public/_redirects', () => {
  it('resolves every LEGACY pair to its target; the first matching line wins', () => {
    for (const [from, to] of LEGACY) {
      const rule = rules.find((r) => matches(r, from));
      expect(rule, from).toBeDefined();
      expect(rule!.status, from).toBe('301');
      const rest = isSplat(rule!) ? from.slice(rule!.from.length - 1) : '';
      expect(rule!.to.replace(':splat', rest), from).toBe(to);
      // Index paths and case-study slugs get exact lines that precede any splat.
      if (!from.includes('/services/') || from.endsWith('/services/')) {
        const exact = rules.findIndex((r) => r.from === from);
        expect(exact, from).toBeGreaterThanOrEqual(0);
        const splat = rules.findIndex((r) => isSplat(r) && matches(r, from));
        if (splat !== -1) expect(exact, from).toBeLessThan(splat);
      }
    }
  });
  it('has slash and no-slash forms of each legacy index', () => {
    for (const lang of LOCALES) {
      for (const base of ['services', 'case-studies']) {
        const froms = rules.map((r) => r.from);
        expect(froms, `${lang}/${base}`).toContain(`/${lang}/${base}/`);
        expect(froms, `${lang}/${base}`).toContain(`/${lang}/${base}`);
      }
    }
  });
  it('splat lines come after all exact legacy lines of their prefix', () => {
    for (const [i, rule] of rules.entries()) {
      if (!isSplat(rule)) continue;
      const prefix = rule.from.slice(0, -1);
      const later = rules.slice(i + 1).filter((r) => !isSplat(r) && r.from.startsWith(prefix));
      expect(
        later.map((r) => r.from),
        rule.from,
      ).toEqual([]);
    }
  });
  it('no rule target is a source', () => {
    const sources = new Set(rules.map((r) => r.from));
    for (const r of rules) expect(sources.has(r.to), r.to).toBe(false);
  });
  it('every non-splat target is an existing route', () => {
    for (const r of rules) {
      if (r.to.includes(':splat') || r.from === '/') continue;
      expect(ROUTES.has(r.to), r.to).toBe(true);
    }
  });
  it('redirects / to /en/', () => {
    expect(rules[0]).toEqual({ from: '/', to: '/en/', status: '301' });
  });
});

describe('sitemapFilter', () => {
  it('rejects legacy and specimen pages', () => {
    expect(sitemapFilter('https://x.test/en/services/soc/')).toBe(false);
    expect(sitemapFilter('https://x.test/vi/case-studies/')).toBe(false);
    expect(sitemapFilter('https://x.test/en/design/')).toBe(false);
  });
  it('accepts current pages', () => {
    expect(sitemapFilter('https://x.test/en/solutions/soc/')).toBe(true);
    expect(sitemapFilter('https://x.test/en/experience/')).toBe(true);
  });
});
