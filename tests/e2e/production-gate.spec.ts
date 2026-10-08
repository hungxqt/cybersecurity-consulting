/**
 * Production gate: the built site must read as a finished, real website.
 *
 * Crawls every URL in sitemap-0.xml (both languages) plus /404.html and fails when visible text,
 * metadata or structured data contains wording that signals unfinished or sample content, the old
 * placeholder domain, or an untranslated "[VI]" marker. It also link-checks every internal href
 * and scans dist/ for leftovers.
 *
 * What is checked: text content, <title>, meta content, JSON-LD, and the VALUES of aria-label,
 * aria-description, alt, title and placeholder attributes. Attribute NAMES are never tested, so a
 * form field's `placeholder` attribute cannot trip the /placeholder/ rule.
 *
 * Hidden text (closed <details>, hidden cards) is included on purpose: it is a superset of what a
 * visitor can see.
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN: RegExp[] = [
  /\[VI\]/,
  /\bsample\b/i,
  /illustrative/i,
  /\bsimulat/i,
  /\bdemo\b/i,
  /placeholder/i,
  /lorem/i,
  /coming soon/i,
  /hungtran\.example/i,
  /\bTBD\b/i,
];

/**
 * Allowlist for educational glossary or blog sentences that genuinely need a banned word.
 * An entry is only honoured when the page path AND the surrounding snippet both match, and every
 * entry needs a one-line reason. It is empty on purpose: the site copy has no such sentence today.
 */
const ALLOW: { pattern: RegExp; path: RegExp; snippet: RegExp; why: string }[] = [];

const PRODUCTION_HOST = 'hungtran.id.vn';

async function sitemapPaths(request: APIRequestContext): Promise<string[]> {
  const xml = await (await request.get('/sitemap-0.xml')).text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname);
}

interface Harvest {
  texts: string[];
  hrefs: string[];
}

async function harvest(page: Page): Promise<Harvest> {
  return page.evaluate(() => {
    const texts: string[] = [document.title];
    const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const parent = n.parentElement;
      if (parent && !skip.has(parent.tagName) && n.textContent?.trim())
        texts.push(n.textContent.trim());
    }
    document
      .querySelectorAll('meta[content]')
      .forEach((m) => texts.push(m.getAttribute('content')!));
    document
      .querySelectorAll('script[type="application/ld+json"]')
      .forEach((s) => texts.push(s.textContent ?? ''));
    document
      .querySelectorAll('[aria-label],[aria-description],[alt],[title],[placeholder]')
      .forEach((el) => {
        for (const a of ['aria-label', 'aria-description', 'alt', 'title', 'placeholder']) {
          const v = el.getAttribute(a);
          if (v) texts.push(v);
        }
      });
    document
      .querySelectorAll('link[rel="canonical"],link[rel="alternate"]')
      .forEach((l) => texts.push(l.getAttribute('href') ?? ''));
    const hrefs = [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')!);
    return { texts, hrefs };
  });
}

function findings(path: string, texts: string[]): string[] {
  const out: string[] = [];
  for (const text of texts) {
    for (const re of FORBIDDEN) {
      const m = re.exec(text);
      if (!m) continue;
      const snippet = text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40);
      if (
        ALLOW.some(
          (a) => a.pattern.source === re.source && a.path.test(path) && a.snippet.test(snippet),
        )
      )
        continue;
      out.push(`${path} ${re}: "${snippet}"`);
    }
  }
  return out;
}

/** Per-worker cache of fetched internal pages: path -> { status, html } */
const fetched = new Map<string, { status: number; html: string }>();

async function fetchPage(request: APIRequestContext, path: string) {
  let hit = fetched.get(path);
  if (!hit) {
    const res = await request.get(path, { maxRedirects: 0 });
    const type = res.headers()['content-type'] ?? '';
    hit = { status: res.status(), html: type.includes('text/html') ? await res.text() : '' };
    fetched.set(path, hit);
  }
  return hit;
}

function internalTarget(href: string): { path: string; hash: string } | null {
  if (/^(mailto:|tel:|javascript:)/i.test(href)) return null;
  let url: URL;
  try {
    url = new URL(href, 'http://localhost:4321/');
  } catch {
    return null;
  }
  const local = url.host === 'localhost:4321' || url.host === PRODUCTION_HOST;
  if (!local || href.startsWith('//')) return null;
  return { path: url.pathname, hash: url.hash.slice(1) };
}

async function checkLinks(request: APIRequestContext, page: Page, from: string, hrefs: string[]) {
  const problems: string[] = [];
  const own = await page.content();
  for (const href of new Set(hrefs)) {
    const t = internalTarget(href);
    if (!t) continue;
    if (t.path === from || href.startsWith('#')) {
      if (t.hash && !new RegExp(`(id|name)="${t.hash}"`).test(own))
        problems.push(`${from}: missing anchor #${t.hash}`);
      continue;
    }
    const res = await fetchPage(request, t.path);
    if (res.status !== 200) {
      problems.push(`${from}: ${href} -> ${res.status}`);
      continue;
    }
    if (t.hash && res.html && !new RegExp(`(id|name)="${t.hash}"`).test(res.html))
      problems.push(`${from}: ${href} has no anchor #${t.hash}`);
  }
  return problems;
}

test('sitemap lists the same pages in both languages', async ({ request }) => {
  const paths = await sitemapPaths(request);
  expect(paths.length).toBeGreaterThanOrEqual(30);
  const en = paths.filter((p) => p.startsWith('/en/')).map((p) => p.slice(3));
  const vi = paths.filter((p) => p.startsWith('/vi/')).map((p) => p.slice(3));
  expect(vi.sort()).toEqual(en.sort());
  for (const p of ['/security/', '/experience/', '/resources/', '/careers/'])
    expect(en, p).toContain(p);
  for (const gone of ['/design/', '/case-studies/', '/services/'])
    expect(
      paths.some((p) => p.includes(gone)),
      gone,
    ).toBe(false);
});

for (const lang of ['en', 'vi'] as const) {
  test(`${lang}: every page reads as production content and every internal link resolves`, async ({
    page,
    request,
  }) => {
    test.setTimeout(240_000);
    const paths = (await sitemapPaths(request)).filter((p) => p.startsWith(`/${lang}/`));
    if (lang === 'en') paths.push('/404.html');
    const problems: string[] = [];
    for (const path of paths) {
      const res = await page.goto(path);
      if (path !== '/404.html' && res?.status() !== 200) problems.push(`${path}: ${res?.status()}`);
      const { texts, hrefs } = await harvest(page);
      problems.push(...findings(path, texts));
      problems.push(...(await checkLinks(request, page, path, hrefs)));
    }
    expect(problems).toEqual([]);
  });
}

test('/404.html is also checked in Vietnamese-facing copy', async ({ page }) => {
  await page.goto('/vi/does-not-exist/');
  const { texts } = await harvest(page);
  expect(findings('/vi/404', texts)).toEqual([]);
});

test('dist/ has no old domain, no [VI] marker and no owner slot', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  expect(existsSync('dist'), 'run npm run build first').toBe(true);
  const files = walk('dist');
  const problems: string[] = [];
  for (const f of files) {
    const ext = f.slice(f.lastIndexOf('.'));
    if (!['.html', '.xml', '.txt', '.json', '.js', '.css'].includes(ext)) continue;
    const body = readFileSync(f, 'utf8');
    if (/hungtran\.example/i.test(body)) problems.push(`${f}: hungtran.example`);
    if (['.html', '.xml', '.txt'].includes(ext) && body.includes('[VI]'))
      problems.push(`${f}: [VI]`);
    if (ext === '.html') {
      for (const needle of ['data-owner-slot', 'owner-slot', 'Owner content:'])
        if (body.includes(needle)) problems.push(`${f}: ${needle}`);
    }
  }
  expect(problems).toEqual([]);
  expect(readFileSync('dist/robots.txt', 'utf8')).toContain(
    `https://${PRODUCTION_HOST}/sitemap-index.xml`,
  );
});
