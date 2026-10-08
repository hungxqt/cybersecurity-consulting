import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface Matrix {
  matchingUrlPattern: string;
  assertions: Record<string, [string, Record<string, number>]>;
}
interface Config {
  ci: {
    collect: { url: string[]; settings: { preset?: string } };
    assert: Record<string, unknown> & { assertMatrix?: Matrix[] };
  };
}

const load = (f: string) => JSON.parse(readFileSync(f, 'utf8')) as Config;

for (const [file, preset] of [
  ['lighthouserc.json', undefined],
  ['lighthouserc.desktop.json', 'desktop'],
] as const) {
  describe(file, () => {
    const cfg = load(file);
    const matrix = cfg.ci.assert.assertMatrix ?? [];

    it('uses assertMatrix only', () => {
      expect(Object.keys(cfg.ci.assert)).toEqual(['assertMatrix']);
      expect(matrix).toHaveLength(2);
    });

    it(`uses the ${preset ?? 'default (mobile)'} preset`, () => {
      expect(cfg.ci.collect.settings.preset).toBe(preset);
    });

    it('matches every collected URL with exactly one pattern', () => {
      for (const url of cfg.ci.collect.url) {
        const hits = matrix.filter((m) => new RegExp(m.matchingUrlPattern).test(url));
        expect(hits, url).toHaveLength(1);
      }
    });

    it('collects home in both languages, a solution, a journey and contact', () => {
      const urls = cfg.ci.collect.url;
      for (const part of ['/en/', '/vi/', '/solutions/soc/', '/journeys/', '/en/contact/'])
        expect(
          urls.some((u) => (part.length <= 4 ? u.endsWith(part) : u.includes(part))),
          part,
        ).toBe(true);
    });

    it('carries the Core Web Vitals and category gates in both entries', () => {
      for (const m of matrix) {
        const a = m.assertions;
        expect(a['largest-contentful-paint']![1].maxNumericValue).toBe(2500);
        expect(a['cumulative-layout-shift']![1].maxNumericValue).toBe(0.1);
        expect(a['total-blocking-time']![1].maxNumericValue).toBe(200);
        expect(a['categories:performance']![1].minScore).toBe(0.9);
        expect(a['categories:accessibility']![1].minScore).toBe(1);
        expect(a['categories:accessibility']![0]).toBe('error');
      }
    });

    it('caps fonts at 110 KiB (en) and 210 KiB (vi)', () => {
      const size = (p: RegExp) =>
        matrix.find((m) => p.test(m.matchingUrlPattern))!.assertions[
          'resource-summary:font:size'
        ]![1].maxNumericValue;
      expect(size(/en/)).toBe(112640);
      expect(size(/vi/)).toBe(215040);
    });
  });
}
