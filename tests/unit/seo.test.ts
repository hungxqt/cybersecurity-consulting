import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { article, jobPosting, organization, serializeJsonLd } from '@/lib/jsonld';

describe('json-ld', () => {
  it('builds an organization', () => {
    const o = organization({
      name: 'HungTran',
      url: 'https://x.test/',
      logo: 'https://x.test/l.png',
      description: 'd',
      email: 'a@b.co',
    });
    expect(o['@type']).toBe('Organization');
    expect(o.name).toBe('HungTran');
  });
  it('builds an article with ISO date and language', () => {
    const a = article({
      headline: 'H',
      description: 'd',
      datePublished: new Date('2026-08-12'),
      author: 'HungTran team',
      url: 'https://x.test/a',
      lang: 'vi',
      publisher: 'HungTran',
      image: 'i',
    });
    expect(a.datePublished).toBe('2026-08-12T00:00:00.000Z');
    expect(a.inLanguage).toBe('vi');
    expect(a.author).toEqual({ '@type': 'Organization', name: 'HungTran team' });
  });
  it('maps employment types and falls back safely', () => {
    const base = {
      title: 't',
      description: 'd',
      datePosted: new Date('2026-09-01'),
      location: 'Hanoi',
      organization: 'HungTran',
      url: 'u',
      lang: 'en' as const,
    };
    expect(jobPosting({ ...base, type: 'full-time' }).employmentType).toBe('FULL_TIME');
    expect(jobPosting({ ...base, type: 'contract' }).employmentType).toBe('CONTRACTOR');
    expect(jobPosting({ ...base, type: 'weird' }).employmentType).toBe('OTHER');
    expect(jobPosting({ ...base, type: 'full-time' }).datePosted).toBe('2026-09-01');
  });
  it('escapes script-closing sequences', () => {
    const out = serializeJsonLd({ a: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('</script>');
    expect(JSON.parse(out).a).toBe('</script><script>alert(1)</script>');
  });
});

describe('_headers file', () => {
  const text = readFileSync('public/_headers', 'utf8');
  const global = text.split(/\n\s*\n/)[0]!;
  const header = (name: string) =>
    global
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.toLowerCase().startsWith(name.toLowerCase() + ':'));

  it('applies to every path', () => {
    expect(global.split('\n')[0]).toBe('/*');
  });
  it('sets a strict CSP', () => {
    const csp = header('Content-Security-Policy')!;
    expect(csp).toBeTruthy();
    for (const d of [
      "default-src 'self'",
      "script-src 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
    ]) {
      expect(csp).toContain(d);
    }
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/);
    expect(csp).not.toMatch(/style-src 'self'[^;]*'unsafe-inline'/);
    expect(csp).toContain("connect-src 'self' https://formspree.io");
  });
  it('sets HSTS with a long max-age', () => {
    const hsts = header('Strict-Transport-Security')!;
    const age = Number(/max-age=(\d+)/.exec(hsts)?.[1]);
    expect(age).toBeGreaterThanOrEqual(31536000);
    expect(hsts).toContain('includeSubDomains');
  });
  it('sets the remaining hardening headers', () => {
    expect(header('X-Content-Type-Options')).toContain('nosniff');
    expect(header('X-Frame-Options')).toContain('DENY');
    expect(header('Referrer-Policy')).toContain('strict-origin');
    const pp = header('Permissions-Policy')!;
    for (const f of ['camera=()', 'microphone=()', 'geolocation=()']) expect(pp).toContain(f);
  });
});

describe('security.txt', () => {
  const txt = readFileSync('public/.well-known/security.txt', 'utf8');
  it('has the required fields and a future expiry', () => {
    expect(txt).toMatch(/^Contact: mailto:/m);
    const exp = /^Expires: (.+)$/m.exec(txt)?.[1];
    expect(exp).toBeTruthy();
    expect(new Date(exp!).getTime()).toBeGreaterThan(Date.now());
  });
});
