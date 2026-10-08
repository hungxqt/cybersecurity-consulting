import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  forLang,
  isPlaceholderEntry,
  langOf,
  publishedCredentials,
  publishedTeam,
  readingMinutes,
  relatedByTags,
  resolveForLang,
  slugOf,
  verifiedCases,
} from '@/lib/content';
import {
  caseSchema,
  certificationSchema,
  postSchema,
  serviceSchema,
  teamSchema,
} from '@/content/schemas';

const d = (s: string) => new Date(s);
const e = (id: string, date: string, tags: string[] = []) => ({
  id,
  data: { date: d(date), tags },
});

describe('content helpers', () => {
  it('parses language and slug from ids', () => {
    expect(langOf('vi/foo')).toBe('vi');
    expect(langOf('foo')).toBeNull();
    expect(slugOf('en/foo-bar')).toBe('foo-bar');
    expect(slugOf('en/foo.mdx')).toBe('foo');
  });
  it('filters by language, hides drafts, sorts newest first', () => {
    const list = [
      e('en/a', '2026-01-01'),
      e('en/b', '2026-03-01'),
      e('vi/a', '2026-01-01'),
      { id: 'en/draft', data: { date: d('2026-05-01'), draft: true } },
    ];
    expect(forLang(list, 'en').map((x) => x.id)).toEqual(['en/b', 'en/a']);
  });
  it('ranks related entries by shared tags, then recency', () => {
    const a = e('en/a', '2026-01-01', ['x', 'y']);
    const b = e('en/b', '2026-02-01', ['x']);
    const c = e('en/c', '2026-03-01', ['x', 'y']);
    const z = e('en/z', '2026-04-01', ['q']);
    expect(relatedByTags(a, [a, b, c, z], 2).map((x) => x.id)).toEqual(['en/c', 'en/b']);
  });
  it('estimates reading time with a floor of one minute', () => {
    expect(readingMinutes('short')).toBe(1);
    expect(readingMinutes('word '.repeat(600))).toBe(3);
  });
});

/* ---- Real content on disk ---- */

const COLLECTIONS = ['posts', 'cases'] as const;

function frontmatter(file: string): Record<string, unknown> {
  const raw = readFileSync(file, 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) throw new Error(`no frontmatter in ${file}`);
  // Tiny YAML subset: scalars, inline arrays and one level of "- key: value" lists.
  const out: Record<string, unknown> = {};
  let listKey: string | null = null;
  for (const line of m[1]!.split(/\r?\n/)) {
    const list = line.match(/^\s+- (\w+):\s*(.*)$/);
    const more = line.match(/^\s{4}(\w+):\s*(.*)$/);
    const top = line.match(/^(\w+):\s*(.*)$/);
    const val = (s: string): unknown => {
      s = s.trim();
      if (s === 'true' || s === 'false') return s === 'true';
      if (s.startsWith('[')) return JSON.parse(s);
      if (s.startsWith('"')) return JSON.parse(s);
      return s;
    };
    if (list && listKey) {
      (out[listKey] as Record<string, unknown>[]).push({ [list[1]!]: val(list[2]!) });
    } else if (more && listKey) {
      const arr = out[listKey] as Record<string, unknown>[];
      arr[arr.length - 1]![more[1]!] = val(more[2]!);
    } else if (top) {
      if (top[2] === '') {
        listKey = top[1]!;
        out[listKey] = [];
      } else {
        listKey = null;
        out[top[1]!] = val(top[2]!);
      }
    }
  }
  return out;
}

const schemaFor = { posts: postSchema, cases: caseSchema } as const;
const mdxIn = (dir: string) => readdirSync(dir).filter((n) => /\.mdx?$/.test(n));

describe('content on disk', () => {
  for (const col of COLLECTIONS) {
    const base = join('src/content', col);
    const en = mdxIn(join(base, 'en'));
    const vi = mdxIn(join(base, 'vi'));

    it(`${col}: every English entry has a Vietnamese twin and vice versa`, () => {
      expect(vi.sort()).toEqual(en.sort());
    });
    it.runIf(col === 'posts')(`${col}: at least three entries per language`, () => {
      expect(en.length).toBeGreaterThanOrEqual(3);
    });
    for (const lang of ['en', 'vi']) {
      for (const file of mdxIn(join(base, lang))) {
        it(`${col}/${lang}/${file} matches its schema`, () => {
          const result = schemaFor[col].safeParse(frontmatter(join(base, lang, file)));
          expect(result.error?.issues ?? []).toEqual([]);
        });
      }
    }
  }
});

describe('data collections', () => {
  const read = (f: string) =>
    JSON.parse(readFileSync(join('src/content/data', f), 'utf8')) as unknown[];
  it('services validate and cover all three services', () => {
    const items = read('services.json').map((x) => serviceSchema.parse(x));
    expect(items.map((s) => s.id).sort()).toEqual(['audit', 'consulting', 'soc']);
  });
  it('serviceSchema has no stage key', () => {
    expect(Object.keys(serviceSchema.shape)).not.toContain('stage');
  });
  it('certifications validate, ids are unique and none is published', () => {
    const items = read('certifications.json').map((x) => certificationSchema.parse(x));
    expect(new Set(items.map((c) => c.id)).size).toBe(items.length);
    expect(items.every((c) => c.publish === false)).toBe(true);
    expect(publishedCredentials(items)).toEqual([]);
  });
  it('team.json validates and its credentials exist in certifications.json', () => {
    const team = read('team.json').map((x) => teamSchema.parse(x));
    const certs = read('certifications.json').map((x) => certificationSchema.parse(x));
    const ids = new Set(certs.map((c) => c.id));
    for (const m of team) {
      for (const c of m.credentials) expect(ids.has(c), `${m.id}: ${c}`).toBe(true);
      if (m.publish) {
        const published = new Set(publishedCredentials(certs).map((c) => c.id));
        for (const c of m.credentials) expect(published.has(c), `${m.id}: ${c}`).toBe(true);
      }
    }
  });
  it('a published certification needs an evidenceUrl', () => {
    const base = { id: 'x', nameKey: 'cert.x', kind: 'company', issuer: 'I' };
    expect(certificationSchema.safeParse({ ...base, publish: true }).success).toBe(false);
    expect(
      certificationSchema.safeParse({ ...base, publish: true, evidenceUrl: 'https://e.test/c' })
        .success,
    ).toBe(true);
    expect(certificationSchema.parse(base).publish).toBe(false);
  });
  it('publishedTeam drops unpublished members and unpublished credentials', () => {
    const certs = [
      { id: 'a', publish: true },
      { id: 'b', publish: false },
    ];
    const team = [
      { id: 'p', publish: true, credentials: ['a', 'b'] },
      { id: 'q', publish: false, credentials: ['a'] },
    ];
    expect(publishedTeam(team, certs)).toEqual([{ id: 'p', publish: true, credentials: ['a'] }]);
  });
  it('schemas reject bad input', () => {
    expect(
      postSchema.safeParse({
        title: '',
        description: 'x',
        date: '2026-01-01',
        author: 'a',
        tags: ['t'],
      }).success,
    ).toBe(false);
  });
});

describe('case authenticity rules', () => {
  const base = {
    title: 'T',
    description: 'D',
    date: '2026-01-01',
    sector: 'S',
    services: ['soc'],
  };
  const metrics = [
    { value: '1', label: 'a' },
    { value: '2', label: 'b' },
  ];
  it('defaults to unverified without metrics', () => {
    const c = caseSchema.parse(base);
    expect(c.verified).toBe(false);
    expect(c.metrics).toBeUndefined();
    expect('illustrative' in c).toBe(false);
  });
  it('rejects metrics on an unverified case', () => {
    expect(caseSchema.safeParse({ ...base, metrics }).success).toBe(false);
    expect(caseSchema.safeParse({ ...base, metrics, verified: false }).success).toBe(false);
  });
  it('accepts a verified reference with 2-4 metrics', () => {
    expect(caseSchema.safeParse({ ...base, verified: true, metrics }).success).toBe(true);
    expect(
      caseSchema.safeParse({ ...base, verified: true, metrics: metrics.slice(0, 1) }).success,
    ).toBe(false);
  });
  it('verifiedCases keeps only verified entries', () => {
    const open = { data: caseSchema.parse(base) };
    const ok = { data: caseSchema.parse({ ...base, verified: true, metrics }) };
    expect(verifiedCases([open, ok])).toEqual([ok]);
    expect(verifiedCases([open])).toEqual([]);
  });
  it('every case on disk (if any) is verified', () => {
    for (const lang of ['en']) {
      for (const f of mdxIn(join('src/content/cases', lang))) {
        expect(frontmatter(join('src/content/cases', lang, f)).verified, f).toBe(true);
      }
    }
  });
});

describe('resolveForLang', () => {
  const post = (id: string, date: string, title: string, draft = false) => ({
    id,
    data: { date: d(date), title, draft },
  });
  const list = [
    post('en/a', '2026-01-01', 'A'),
    post('en/b', '2026-03-01', 'B'),
    post('en/c', '2026-02-01', 'C'),
    post('vi/a', '2026-01-01', '[VI] A'),
    post('vi/b', '2026-03-01', 'B tiếng Việt'),
    post('vi/c', '2026-02-01', '[VI] C', true),
    post('vi/only', '2026-04-01', 'Chỉ có tiếng Việt'),
  ];
  it('detects placeholder titles', () => {
    expect(isPlaceholderEntry(post('vi/a', '2026-01-01', '[VI] A'))).toBe(true);
    expect(isPlaceholderEntry(post('vi/a', '2026-01-01', 'A'))).toBe(false);
  });
  it('falls back to the English entry for a placeholder, newest first', () => {
    expect(resolveForLang(list, 'vi').map((x) => x.id)).toEqual([
      'vi/only',
      'vi/b',
      'en/c',
      'en/a',
    ]);
  });
  it('never returns a placeholder or a draft', () => {
    for (const x of resolveForLang(list, 'vi')) {
      expect(x.data.title.startsWith('[VI]')).toBe(false);
      expect(x.data.draft).toBe(false);
    }
  });
  it('leaves English untouched', () => {
    expect(resolveForLang(list, 'en').map((x) => x.id)).toEqual(['en/b', 'en/c', 'en/a']);
  });
});
