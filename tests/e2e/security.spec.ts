import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

/** Parse the `/*` block of public/_headers, the way Cloudflare Pages would apply it. */
function globalHeaders(): Record<string, string> {
  const block = readFileSync('public/_headers', 'utf8').split(/\n\s*\n/)[0]!;
  const out: Record<string, string> = {};
  for (const line of block.split('\n').slice(1)) {
    const i = line.indexOf(':');
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

/** Serve every response with the production headers so CSP violations show up locally. */
async function applyProductionHeaders(page: Page) {
  const headers = globalHeaders();
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (!url.startsWith('http://localhost')) return route.continue();
    const res = await route.fetch();
    await route.fulfill({ response: res, headers: { ...res.headers(), ...headers } });
  });
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { __csp: string[] }).__csp.push(
        `${e.violatedDirective} ${e.blockedURI}`,
      );
    });
  });
}

const PAGES = [
  '/en/',
  '/vi/',
  '/en/solutions/consulting/',
  '/en/solutions/audit/',
  '/en/solutions/soc/',
  '/en/resources/',
  '/en/contact/',
  '/en/about/',
  '/en/blog/alert-queue-is-lying/',
  '/en/experience/',
  '/en/experience/journeys/vendor-account/',
  '/en/careers/',
];

test('every page works under the production CSP with no violations', async ({ page }) => {
  await applyProductionHeaders(page);
  const consoleCsp: string[] = [];
  page.on(
    'console',
    (m) => /Content Security Policy|Refused to/i.test(m.text()) && consoleCsp.push(m.text()),
  );
  for (const url of PAGES) {
    await page.goto(url);
    await page.waitForTimeout(600);
    const seen = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
    expect(seen, url).toEqual([]);
  }
  expect(consoleCsp).toEqual([]);
});

test('interactive features still work under the CSP', async ({ page }) => {
  await applyProductionHeaders(page);
  await page.goto('/en/');
  await expect(page.locator('[data-nexus][data-live]')).toHaveCount(1, { timeout: 15_000 });
  await page.goto('/en/experience/');
  await page.goto('/en/solutions/audit/');
  await page.getByLabel('PCI DSS').uncheck();
  await expect(page.locator('th[data-fw="pci"]')).toBeHidden();
  const csp = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
  expect(csp).toEqual([]);
});

test('no page ships inline scripts or style blocks', async ({ request }) => {
  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  const urls = [...sitemap.matchAll(/<loc>https?:\/\/[^/]+(\/[^<]*)<\/loc>/g)].map((m) => m[1]!);
  expect(urls.length).toBeGreaterThan(30);
  for (const path of urls) {
    const html = await (await request.get(path)).text();
    const inlineScripts = [
      ...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/(ld\+)?json")[^>]*>/g),
    ];
    expect(inlineScripts.length, `${path} inline scripts`).toBe(0);
    expect(html.includes('<style'), `${path} <style>`).toBe(false);
  }
});

test('sitemap excludes legacy routes; robots and security.txt are served', async ({ request }) => {
  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  expect(sitemap).toContain('/en/solutions/soc/');
  expect(sitemap).not.toContain('/services/');
  expect(sitemap).not.toContain('/case-studies/');
  expect(sitemap).toContain('hreflang="vi"');
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Sitemap:');
  expect(robots).not.toContain('design');
  const sec = await request.get('/.well-known/security.txt');
  expect(sec.status()).toBe(200);
  expect(await sec.text()).toContain('Contact: mailto:');
});

test('pages carry canonical, OG image and structured data', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    /\/og\/en\.png$/,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/en\/$/);
  const org = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').first().textContent())!,
  );
  expect(org['@type']).toBe('Organization');

  await page.goto('/en/blog/iso-27001-or-soc-2/');
  const art = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').first().textContent())!,
  );
  expect(art['@type']).toBe('Article');
  expect(art.inLanguage).toBe('en');
});
