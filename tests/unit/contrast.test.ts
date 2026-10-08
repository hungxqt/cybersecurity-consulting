import { describe, expect, it } from 'vitest';
import { contrastRatio, luminance } from '@/lib/contrast';
import { ATLAS, CONTRAST_PAIRS, NEXUS, SEMANTIC } from '@/lib/palette';

describe('contrast formula', () => {
  it('matches known WCAG values', () => {
    expect(contrastRatio('#000', '#FFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
    expect(contrastRatio('#FFFFFF', '#777777')).toBeCloseTo(contrastRatio('#777777', '#FFFFFF'));
    expect(luminance('#000000')).toBe(0);
    expect(luminance('#ffffff')).toBeCloseTo(1, 10);
  });
  it('rejects malformed colours', () => {
    expect(() => luminance('#12')).toThrow();
    expect(() => luminance('red')).toThrow();
  });
});

describe('design §2.4 measured ratios', () => {
  const cases: [string, string, number][] = [
    [NEXUS['c-frost'], NEXUS['c-carbon'], 16.16],
    [NEXUS['c-ash'], NEXUS['c-carbon'], 7.41],
    [NEXUS['c-cyan-300'], NEXUS['c-graphite'], 8.43],
    [NEXUS['c-flare-400'], NEXUS['c-flare-950'], 6.05],
    [NEXUS['c-wire-strong'], NEXUS['c-slate'], 3.31],
    [NEXUS['c-carbon'], NEXUS['c-flare-400'], 6.75],
    [ATLAS['c-ink'], ATLAS['c-drafting'], 15.95],
    [ATLAS['c-graphite-600'], ATLAS['c-cyan-50'], 5.99],
    [ATLAS['c-rule'], ATLAS['c-drafting'], 3.88],
    [ATLAS['c-flare-700'], ATLAS['c-flare-50'], 4.97],
    [ATLAS['c-cyan-500'], ATLAS['c-cyan-50'], 4.18],
  ];
  for (const [fg, bg, expected] of cases) {
    it(`${fg} on ${bg} ≈ ${expected}`, () => {
      expect(Math.abs(contrastRatio(fg, bg) - expected)).toBeLessThanOrEqual(0.01);
    });
  }
});

describe('CONTRAST_PAIRS', () => {
  it('meets 4.5:1 for text and 3:1 for UI boundaries', () => {
    const failures = CONTRAST_PAIRS.filter(
      (p) => contrastRatio(p.fg, p.bg) < (p.kind === 'text' ? 4.5 : 3),
    ).map((p) => `${p.theme}: ${p.label} = ${contrastRatio(p.fg, p.bg).toFixed(2)}`);
    expect(failures).toEqual([]);
  });

  it('includes the full generated semantic matrix for both themes', () => {
    const labels = new Set(CONTRAST_PAIRS.map((p) => `${p.theme}:${p.label}:${p.kind}`));
    const expected: string[] = [];
    for (const theme of ['nexus', 'atlas'] as const) {
      for (const fg of ['text', 'text-dim'])
        for (const bg of ['bg', 'surface', 'surface-2', 'threat-tint'])
          expected.push(`${theme}:${fg} on ${bg}:text`);
      for (const fg of ['accent', 'threat'])
        for (const bg of ['bg', 'surface', 'surface-2'])
          expected.push(`${theme}:${fg} on ${bg}:text`);
      for (const fg of ['rule-ui', 'accent-line', 'focus'])
        for (const bg of ['bg', 'surface', 'surface-2'])
          expected.push(`${theme}:${fg} on ${bg}:ui`);
      expected.push(`${theme}:btn-text on btn-bg:text`);
    }
    expect(expected.filter((e) => !labels.has(e))).toEqual([]);
  });

  it('includes the explicit extras', () => {
    const has = (fg: string, bg: string, kind: 'text' | 'ui') =>
      CONTRAST_PAIRS.some((p) => p.fg === fg && p.bg === bg && p.kind === kind);
    expect(has(NEXUS['c-carbon'], NEXUS['c-flare-400'], 'text')).toBe(true); // Critical tag
    expect(has(NEXUS['c-frost'], NEXUS['c-cyan-700'], 'text')).toBe(true); // selection
    expect(has(NEXUS['c-frost'], NEXUS['c-carbon'], 'ui')).toBe(true); // active ring
    expect(has(NEXUS['c-frost'], NEXUS['c-slate'], 'text')).toBe(true); // banner
    expect(has(NEXUS['c-ash'], NEXUS['c-slate'], 'text')).toBe(true); // banner label
  });

  it('semantic maps cover the same tokens in both themes', () => {
    expect(Object.keys(SEMANTIC.atlas).sort()).toEqual(Object.keys(SEMANTIC.nexus).sort());
  });
});
