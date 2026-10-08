import { expect, test } from '@playwright/test';

const color = (page: import('@playwright/test').Page, sel: string, prop: string) =>
  page
    .locator(sel)
    .first()
    .evaluate((e, p) => getComputedStyle(e).getPropertyValue(p), prop);

test('theme attribute: nexus on home, atlas on solutions', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'nexus');
  await page.goto('/en/solutions/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'atlas');
});

test('on the SOC page the footer and hunt HUD stay nexus', async ({ page }) => {
  await page.goto('/en/solutions/soc/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'atlas');
  await expect(page.locator('footer.site-footer')).toHaveAttribute('data-theme', 'nexus');
  await expect(page.locator('.hud')).toHaveAttribute('data-theme', 'nexus');
});

test('logo colours follow the theme', async ({ page }) => {
  await page.goto('/en/solutions/');
  expect(await color(page, 'header .logo', 'color')).toBe('rgb(15, 26, 36)');
  expect(await color(page, 'header .logo__node--accent', 'fill')).toBe('rgb(15, 76, 129)');
  await page.goto('/en/');
  expect(await color(page, 'header .logo', 'color')).toBe('rgb(232, 236, 239)');
  expect(await color(page, 'header .logo__node--accent', 'fill')).toBe('rgb(134, 184, 232)');
});

test('attribute updates after client-side navigation both ways', async ({ page }) => {
  await page.goto('/en/');
  await page.getByRole('link', { name: 'Explore solutions' }).click();
  await expect(page).toHaveURL(/\/en\/solutions\/$/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'atlas');
  await page.locator('header .logo').click();
  await expect(page).toHaveURL(/\/en\/$/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'nexus');
});

for (const [theme, urls] of [
  ['atlas', ['/en/blog/', '/en/blog/alert-queue-is-lying/', '/en/careers/']],
  ['nexus', ['/en/about/', '/en/resources/', '/en/contact/', '/en/experience/']],
] as const) {
  for (const url of urls) {
    test(`${url} uses the ${theme} theme`, async ({ page }) => {
      await page.goto(url);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    });
  }
}

test('404 page uses nexus and offers a way back', async ({ page }) => {
  const res = await page.goto('/en/does-not-exist/');
  expect(res?.status()).toBe(404);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'nexus');
  await expect(page.getByRole('link', { name: 'Go to home' }).first()).toBeVisible();
});
