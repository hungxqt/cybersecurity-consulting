import { expect, test } from '@playwright/test';
import { LEGACY } from '../../src/lib/legacyRoutes.mjs';

// astro preview serves the static meta-refresh pages Astro emits for `redirects`.
for (const [from, to] of LEGACY) {
  test(`${from} ends at ${to}`, async ({ page }) => {
    await page.goto(from);
    await expect(page).toHaveURL(new RegExp(`${to.replace(/\//g, '\\/')}$`));
    await expect(page.locator('h1').first()).toBeVisible();
  });
}
