import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const SCENARIOS = [
  'logistics-soc-onboarding',
  'fintech-soc2-readiness',
  'health-portal-threat-modeling',
];

const DETAILS = [
  'blog/alert-queue-is-lying/',
  'blog/iso-27001-or-soc-2/',
  'blog/attack-surface-bigger-than-asset-list/',
  ...SCENARIOS.map((s) => `experience/scenarios/${s}/`),
  'careers/soc-analyst-tier-2/',
  'careers/penetration-tester/',
  'careers/grc-audit-consultant/',
];

for (const lang of ['en', 'vi'] as const) {
  test.describe(`${lang} content`, () => {
    for (const [list, rows] of [
      ['blog/', '.rows .row'],
      ['careers/', '.roles tbody tr'],
    ] as const) {
      test(`/${lang}/${list} lists three entries`, async ({ page }) => {
        await page.goto(`/${lang}/${list}`);
        await expect(page.locator(rows)).toHaveCount(3);
      });
    }
    test(`/${lang}/experience/ lists three scenarios in the library`, async ({ page }) => {
      await page.goto(`/${lang}/experience/`);
      const rows = page.locator('#library .lib__row');
      await expect(rows).toHaveCount(3);
      const hrefs = await rows
        .locator('.lib__title a')
        .evaluateAll((els) => els.map((e) => e.getAttribute('href')));
      expect(hrefs.sort()).toEqual(
        SCENARIOS.map((s) => `/${lang}/experience/scenarios/${s}/`).sort(),
      );
    });
    for (const detail of DETAILS) {
      test(`/${lang}/${detail} renders and passes axe`, async ({ page }) => {
        await page.goto(`/${lang}/${detail}`);
        await expect(page.locator('h1')).toBeVisible();
        const r = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
          .analyze();
        expect(r.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
      });
    }
  });
}

test('blog post shows byline, related posts and reading progress', async ({ page }) => {
  await page.goto('/en/blog/alert-queue-is-lying/');
  await expect(page.getByText(/min read/).first()).toBeVisible();
  await expect(page.getByText('HungTran team').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Keep reading' })).toBeVisible();
  const bar = page.getByRole('progressbar', { name: 'Reading progress' });
  await expect(bar).toHaveAttribute('aria-valuenow', '0');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect
    .poll(async () => Number(await bar.getAttribute('aria-valuenow')))
    .toBeGreaterThan(80);
});

for (const slug of SCENARIOS) {
  test(`scenario ${slug} is labelled illustrative and shows no results`, async ({ page }) => {
    await page.goto(`/en/experience/scenarios/${slug}/`);
    const banner = page.locator('[data-banner]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Illustrative scenario');
    await expect(banner).toContainText('not a client engagement');
    // The banner precedes the h1 in document order.
    const order = await page.evaluate(() => {
      const b = document.querySelector('[data-banner]')!;
      const h = document.querySelector('h1')!;
      return b.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING;
    });
    expect(order).toBeTruthy();
    await expect(page.getByText('Published', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /All scenarios/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Situation' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Approach', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What this approach changes' })).toBeVisible();
    await expect(page.locator('[data-metrics]')).toHaveCount(0);
    const main = (await page.locator('main').innerText()) ?? '';
    expect(main).not.toContain('41 h');
    expect(main).not.toContain('9 min');
    expect(main).not.toContain('%');
  });
}

test('careers pages show the sample-roles notice', async ({ page }) => {
  for (const url of ['/en/careers/', '/en/careers/penetration-tester/']) {
    await page.goto(url);
    await expect(page.locator('[data-sample]')).toContainText(
      'These role descriptions are examples.',
    );
  }
});

test('job apply link carries the role to the contact page', async ({ page }) => {
  await page.goto('/en/careers/penetration-tester/');
  await expect(page.getByRole('link', { name: 'Apply for this role' })).toHaveAttribute(
    'href',
    '/en/contact/?role=penetration-tester',
  );
});

test('vietnamese entries are visibly marked as placeholders', async ({ page }) => {
  await page.goto('/vi/blog/alert-queue-is-lying/');
  await expect(page.locator('h1')).toContainText('[VI]');
});
