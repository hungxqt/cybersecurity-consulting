import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const lang of ['en', 'vi'] as const) {
  test(`/${lang}/security/ renders the disclosure policy and passes axe`, async ({ page }) => {
    await page.goto(`/${lang}/security/`);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('section[aria-labelledby]')).toHaveCount(7);
    const mail = page.locator('a[href="mailto:security@hungtran.id.vn"]');
    await expect(mail).toBeVisible();
    await expect(page.getByRole('link', { name: /security\.txt/i })).toHaveAttribute(
      'href',
      '/.well-known/security.txt',
    );
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  });
}

test('English policy states scope, testing rules and expectations', async ({ page }) => {
  await page.goto('/en/security/');
  for (const heading of [
    'How to report',
    'What to include',
    'Testing rules',
    'What to expect from us',
    'Good faith',
    'Machine-readable',
  ]) {
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Scope', exact: true })).toBeVisible();
  await expect(page.getByText('We do not currently run a paid bug bounty program.')).toBeVisible();
  await expect(page.getByText(/Last updated 8 Oct 2026/)).toBeVisible();
});

test('footer links to the policy page and security.txt points at the same mailbox', async ({
  page,
  request,
}) => {
  await page.goto('/en/');
  await page.getByRole('link', { name: 'Report a vulnerability' }).click();
  await expect(page).toHaveURL(/\/en\/security\/$/);

  const txt = await (await request.get('/.well-known/security.txt')).text();
  expect(txt).toContain('Contact: mailto:security@hungtran.id.vn');
  expect(txt).toContain('Policy: https://hungtran.id.vn/en/security/');
});

test('policy page is in the sitemap', async ({ request }) => {
  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  expect(sitemap).toContain('/en/security/');
  expect(sitemap).toContain('/vi/security/');
});
