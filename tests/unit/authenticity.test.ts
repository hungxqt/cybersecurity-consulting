import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards design §10: no invented credentials, people, results or claims anywhere in the source.
 * Educational mentions (framework names in the glossary, matrix, blog) are not in this list.
 */
const FORBIDDEN: [string, RegExp][] = [
  ['Linh Pham', /Linh Pham/],
  ['Minh Nguyen', /Minh Nguyen/],
  ['An Le', /\bAn Le\b/],
  ['Hung Tran (with a space)', /Hung Tran/],
  ['41 h', /\b41 h\b/],
  ['9 min', /\b9 min\b/],
  ['-72%', /-72%/],
  ['-60%', /-60%/],
  ['five months', /five months/i],
  ['qualified opinions', /qualified opinions/i],
  ['certified to ISO', /certified to ISO/i],
  ['audited to SOC 2', /audited to SOC 2/i],
  ['Certified and audited', /Certified and audited/i],
  ['Asia-Pacific and Europe', /Asia-Pacific and Europe/i],
  ['business day', /business day/i],
  ['keep our clients safe', /keep our clients safe/i],
  ['Hanoi (hybrid)', /Hanoi \(hybrid\)/],
  ['Ho Chi Minh City (hybrid)', /Ho Chi Minh City \(hybrid\)/],
];

function walk(dir: string, exts: string[], out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, exts, out);
    else if (exts.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}

const files = [
  'src/i18n/en.json',
  'src/i18n/vi.json',
  ...walk('src/content', ['.mdx', '.json']),
  ...walk('src', ['.astro']),
];

describe('authenticity: forbidden claims', () => {
  for (const [label, re] of FORBIDDEN) {
    it(`no source contains "${label}"`, () => {
      const hits = files.filter((f) => re.test(readFileSync(f, 'utf8')));
      expect(hits).toEqual([]);
    });
  }
});

describe('authenticity: certification keys', () => {
  it('no .astro file other than Credentials.astro references a cert.* key', () => {
    const hits = walk('src', ['.astro'])
      .filter((f) => !f.replaceAll('\\', '/').endsWith('components/Credentials.astro'))
      .filter((f) => /['"`]cert\.[a-z0-9]/i.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });
  it('src/lib/nav.ts no longer exports certification lists', () => {
    const nav = readFileSync('src/lib/nav.ts', 'utf8');
    expect(nav).not.toMatch(/CERT_KEYS|CREDENTIAL_KEYS|FOOTER_LEARN/);
  });
  it('every certification is unpublished until evidence exists', () => {
    const certs = JSON.parse(readFileSync('src/content/data/certifications.json', 'utf8')) as {
      publish: boolean;
      evidenceUrl?: string;
    }[];
    for (const c of certs) if (c.publish) expect(c.evidenceUrl).toBeTruthy();
  });
});

describe('authenticity: scenarios', () => {
  const dir = 'src/content/cases/en';
  for (const f of readdirSync(dir)) {
    it(`${f}: illustrative title and description start with "Scenario:" and carry no metrics`, () => {
      const raw = readFileSync(join(dir, f), 'utf8');
      const front = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1]!;
      if (/^illustrative:\s*false/m.test(front)) return;
      expect(front).toMatch(/^title:\s*"Scenario:/m);
      expect(front).toMatch(/^description:\s*"Scenario:/m);
      expect(front).not.toMatch(/^metrics:/m);
    });
  }
});
