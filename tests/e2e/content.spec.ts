import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const DETAILS = [
  'blog/alert-queue-is-lying/',
  'blog/iso-27001-or-soc-2/',
  'blog/attack-surface-bigger-than-asset-list/',
];

for (const lang of ['en', 'vi'] as const) {
  test.describe(`${lang} content`, () => {
    test(`/${lang}/blog/ lists three entries`, async ({ page }) => {
      await page.goto(`/${lang}/blog/`);
      await expect(page.locator('.rows .row')).toHaveCount(3);
    });
    test(`/${lang}/experience/ has journeys and no scenario library`, async ({ page }) => {
      await page.goto(`/${lang}/experience/`);
      await expect(page.locator('#journeys')).toBeVisible();
      await expect(page.locator('#library')).toHaveCount(0);
      await expect(page.locator('[data-references]')).toHaveCount(0);
      await expect(page.getByText(/Scenario library|Illustrative/)).toHaveCount(0);
      await expect(page.locator('[data-hunt-spot="exposed-backup"]')).toBeVisible();
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

test('careers says there are no open roles and offers one way to get in touch', async ({
  page,
}) => {
  await page.goto('/en/careers/');
  await expect(page.getByText('We do not have open roles listed right now')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Send us your details' })).toHaveCount(1);
  await expect(page.locator('table')).toHaveCount(0);
});

test('vietnamese blog entries fall back to English and never show [VI]', async ({ page }) => {
  await page.goto('/vi/blog/alert-queue-is-lying/');
  await expect(page.locator('h1')).toHaveText('Your SOC alert queue is lying to you');
  expect(await page.content()).not.toContain('[VI]');
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.join('')).not.toContain('[VI]');
});
