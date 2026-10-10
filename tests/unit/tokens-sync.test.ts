import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PALETTE, SEMANTIC, type Theme } from '@/lib/palette';

const css = readFileSync('src/styles/tokens.css', 'utf8');
const tokens = css;

function declarations(block: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of block.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) out.set(m[1]!, m[2]!.trim());
  return out;
}

function scope(theme: Theme): Map<string, string> {
  const re =
    theme === 'nexus'
      ? /:root,\s*\[data-theme='nexus'\]\s*\{([^}]*)\}/
      : /\[data-theme='atlas'\]\s*\{([^}]*)\}/;
  const m = tokens.match(re);
  if (!m) throw new Error(`No ${theme} scope in tokens.css`);
  return declarations(m[1]!);
}

describe('tokens.css mirrors palette.ts', () => {
  const declared = declarations(tokens);

  for (const [name, hex] of Object.entries(PALETTE)) {
    it(`--${name} is ${hex}`, () => {
      expect(declared.get(name)?.toUpperCase()).toBe(hex.toUpperCase());
    });
  }

  for (const theme of ['nexus', 'atlas'] as const) {
    it(`the ${theme} scope maps every semantic token to the palette.ts raw token`, () => {
      const decl = scope(theme);
      const expected = Object.entries(SEMANTIC[theme]).map(([k, raw]) => [k, `var(--${raw})`]);
      const actual = expected.map(([k]) => [k, decl.get(k!)]);
      expect(actual).toEqual(expected);
    });

    it(`the ${theme} scope references only defined raw tokens`, () => {
      const decl = scope(theme);
      const undefinedRefs = [...decl.values()]
        .flatMap((v) => [...v.matchAll(/var\(--([a-z0-9-]+)\)/gi)].map((m) => m[1]!))
        .filter((ref) => !(ref in PALETTE) || !declared.has(ref));
      expect(undefinedRefs).toEqual([]);
    });
  }
});

/** Every file under src/ that can carry styles or markup. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.(astro|css|ts|mjs|mdx)$/.test(name) ? [p] : [];
  });
}

describe('legacy Aurora styling is gone from src/', () => {
  const files = sources('src').map((p) => [p, readFileSync(p, 'utf8')] as const);

  it('has no LEGACY ALIASES block', () => {
    expect(css).not.toContain('LEGACY ALIASES');
  });

  const banned: [string, RegExp][] = [
    ['#7c5cff', /#7c5cff/i],
    ['#3ce3ff', /#3ce3ff/i],
    ['#120a24', /#120a24/i],
    ['#fff', /#fff(?![0-9a-f])/i],
    ['rgb(124 92 255', /rgb\(\s*124[ ,]+92[ ,]+255/i],
    ['999px', /(?<![0-9])999px/],
    ['radial-gradient', /radial-gradient/],
  ];
  for (const [label, re] of banned) {
    it(`contains no ${label}`, () => {
      expect(files.filter(([, text]) => re.test(text)).map(([p]) => p)).toEqual([]);
    });
  }

  it('limits frosted glass to the requested customer reviews component', () => {
    const hits = files
      .filter(([, text]) => /backdrop-filter/.test(text))
      .map(([p]) => p.replaceAll('\\', '/'));
    expect(hits).toEqual(['src/components/CustomerReviews.astro']);
  });

  const removedTokens = [
    'c-violet',
    'c-cyan',
    'c-amber',
    'c-midnight',
    'c-plum',
    'c-plum-2',
    'c-lilac',
    'c-lilac-dim',
    'c-line',
    'c-line-strong',
    'accent-2',
    'surface-raised',
    'ok',
    'fs-xs',
    'fs-sm',
    'fs-base',
    'fs-md',
    'fs-lg',
    'fs-xl',
    'fs-2xl',
    'lh-tight',
    'lh-snug',
    'lh-body',
    'radius-sm',
    'ease-out',
  ];
  it('references no removed legacy token name', () => {
    const hits: string[] = [];
    for (const [p, text] of files)
      for (const name of removedTokens)
        if (new RegExp(`--${name}(?![-\\w])`).test(text)) hits.push(`${p}: --${name}`);
    expect(hits).toEqual([]);
  });
});
