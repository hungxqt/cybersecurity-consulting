/**
 * Client scripts must never import src/lib/i18n: it statically imports both dictionaries
 * (≈ 20 KB each) into the browser bundle (design §11.2 item 5, §14.3). Client strings come from
 * data-* attributes rendered at build time; templating uses the dependency-free lib/interpolate.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface ImportRef {
  specifier: string;
  typeOnly: boolean;
}

function walk(dir: string, ext: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}

/** Bodies of the client <script> blocks of an .astro file (frontmatter and JSON-LD excluded). */
function clientScripts(source: string): string[] {
  const body = source.replace(/^---\r?\n[\s\S]*?\r?\n---/, '');
  const out: string[] = [];
  let i = 0;
  for (;;) {
    const start = body.indexOf('<script', i);
    if (start === -1) break;
    const tagEnd = body.indexOf('>', start);
    if (tagEnd === -1) break;
    const attrs = body.slice(start + '<script'.length, tagEnd);
    if (attrs.trimEnd().endsWith('/')) {
      i = tagEnd + 1;
      continue;
    }
    const close = body.indexOf('</script>', tagEnd);
    if (close === -1) break;
    if (!/type=["']application\/(ld\+)?json["']/.test(attrs))
      out.push(body.slice(tagEnd + 1, close));
    i = close + '</script>'.length;
  }
  return out;
}

/** Static, side-effect and dynamic imports with whether they are erased at build (type-only). */
function importsOf(code: string): ImportRef[] {
  const refs: ImportRef[] = [];
  for (const m of code.matchAll(/\bimport\s+([^'";]*?)\s*from\s*['"]([^'"]+)['"]/g)) {
    const clause = m[1]!.trim();
    const named = clause.match(/^\{([\s\S]*)\}$/);
    const typeOnly =
      /^type\s/.test(clause) ||
      (named !== null &&
        named[1]!
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .every((s) => s.startsWith('type ')));
    refs.push({ specifier: m[2]!, typeOnly });
  }
  for (const m of code.matchAll(/\bimport\s+['"]([^'"]+)['"]/g))
    refs.push({ specifier: m[1]!, typeOnly: false });
  for (const m of code.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g))
    refs.push({ specifier: m[1]!, typeOnly: false });
  return refs;
}

const I18N_FROM_CLIENT = /lib\/i18n(\.ts)?$/;
const I18N_FROM_LIB = /^\.\/i18n(\.ts)?$/;

function resolveLib(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.') || !/(^|\/)lib\//.test(specifier)) return null;
  const base = resolve(dirname(fromFile), specifier);
  for (const candidate of [base, `${base}.ts`]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function violations(): { files: number; scripts: number; problems: string[] } {
  const files = [...walk('src/components', '.astro'), ...walk('src/pages', '.astro')];
  const problems: string[] = [];
  let scripts = 0;
  for (const file of files) {
    for (const code of clientScripts(readFileSync(file, 'utf8'))) {
      scripts++;
      for (const ref of importsOf(code)) {
        if (ref.typeOnly) continue;
        if (I18N_FROM_CLIENT.test(ref.specifier)) {
          problems.push(`${relative('.', file)} imports ${ref.specifier}`);
          continue;
        }
        const lib = resolveLib(file, ref.specifier);
        if (!lib) continue;
        for (const inner of importsOf(readFileSync(lib, 'utf8'))) {
          if (!inner.typeOnly && I18N_FROM_LIB.test(inner.specifier))
            problems.push(`${relative('.', file)} → ${relative('.', lib)} imports ./i18n`);
        }
      }
    }
  }
  return { files: files.length, scripts, problems };
}

describe('client script imports', () => {
  it('extracts client scripts but not frontmatter or JSON-LD', () => {
    const src = [
      '---',
      "import { useT } from '../lib/i18n';",
      '---',
      '<script type="application/ld+json" set:html={x} />',
      '<script type="application/ld+json">{"a":1}</script>',
      '<div></div>',
      '<script>',
      "  import { interpolate } from '../lib/interpolate';",
      '</script>',
    ].join('\n');
    const scripts = clientScripts(src);
    expect(scripts).toHaveLength(1);
    expect(importsOf(scripts[0]!).map((r) => r.specifier)).toEqual(['../lib/interpolate']);
  });

  it('distinguishes type-only imports', () => {
    const refs = importsOf(
      [
        "import type { Lang } from '../lib/i18n';",
        "import { type Dict, type Lang } from '../lib/i18n';",
        "import { useT, type Lang } from '../lib/i18n';",
        "import {\n  a,\n  b,\n} from '../lib/x';",
        "const g = import('gsap');",
      ].join('\n'),
    );
    expect(refs).toEqual([
      { specifier: '../lib/i18n', typeOnly: true },
      { specifier: '../lib/i18n', typeOnly: true },
      { specifier: '../lib/i18n', typeOnly: false },
      { specifier: '../lib/x', typeOnly: false },
      { specifier: 'gsap', typeOnly: false },
    ]);
  });

  it('no client <script> imports lib/i18n, directly or through a src/lib module', () => {
    const { files, scripts, problems } = violations();
    expect(files).toBeGreaterThan(10);
    expect(scripts).toBeGreaterThan(5);
    expect(problems).toEqual([]);
  });
});
