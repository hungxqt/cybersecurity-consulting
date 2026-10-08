import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/global.css', 'utf8');

describe('view transition styles', () => {
  it('shortens the root cross-fade to 100-150 ms', () => {
    const rule = css.match(/::view-transition-group\(root\)\s*\{([^}]*)\}/);
    expect(rule).not.toBeNull();
    const seconds = rule![1]!.match(/animation-duration:\s*([\d.]+)s/);
    expect(seconds).not.toBeNull();
    const ms = Number(seconds![1]) * 1000;
    expect(ms).toBeGreaterThanOrEqual(100);
    expect(ms).toBeLessThanOrEqual(150);
  });

  it('swaps instantly under prefers-reduced-motion', () => {
    const block = css.match(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*::view-transition-group\(\*\),\s*::view-transition-old\(\*\),\s*::view-transition-new\(\*\)\s*\{([^}]*)\}/,
    );
    expect(block).not.toBeNull();
    expect(block![1]).toMatch(/animation:\s*none\s*!important/);
  });
});
