import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const languages = ['en', 'vi'] as const;

for (const lang of languages) {
  test(`${lang}: reviews replace the homepage journey and support keyboard selection`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/${lang}/`);
    const reviews = page.locator('#customer-reviews');
    await expect(reviews).toHaveAttribute('data-ready', '');
    await expect(page.locator('#breach-h')).toHaveCount(0);
    await expect(page.locator('main .reel')).toHaveCount(0);
    const buttons = reviews.locator('[data-review-select]');
    const panels = reviews.locator('[data-review-panel]');
    await expect(buttons).toHaveCount(3);
    await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(panels.nth(0)).toBeVisible();
    await expect(panels.nth(1)).toBeHidden();
    const height = await reviews
      .locator('.reviews__quotes')
      .evaluate((el) => (el as HTMLElement).offsetHeight);
    await buttons.nth(0).focus();
    await page.keyboard.press('Tab');
    await expect(buttons.nth(1)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(buttons.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(panels.nth(0)).toHaveAttribute('aria-hidden', 'true');
    await expect(panels.nth(1)).toBeVisible();
    await expect(panels.nth(1)).not.toHaveAttribute('inert');
    await expect(reviews.locator('[data-review-status]')).toHaveText(
      (await buttons.nth(1).getAttribute('data-announcement')) ?? '',
    );
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    await expect(buttons.nth(2)).toHaveAttribute('aria-pressed', 'true');
    await expect(panels.nth(2)).toBeVisible();
    await expect(reviews.locator('[aria-pressed="true"]')).toHaveCount(1);
    expect(
      await reviews.locator('.reviews__quotes').evaluate((el) => (el as HTMLElement).offsetHeight),
    ).toBe(height);
    await expect(page.locator('#reviews-disclosure')).toHaveCount(0);
    await expect(reviews.locator('.reviews__contact')).toHaveAttribute(
      'href',
      `/${lang}/contact/?topic=other`,
    );
    expect(await page.locator('script[type="application/ld+json"]').allTextContents()).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/AggregateRating|"@type"\s*:\s*"Review"/)]),
    );
    expect(
      (await new AxeBuilder({ page }).include('#customer-reviews').analyze()).violations,
    ).toEqual([]);
  });

  for (const width of [360, 768, 1440]) {
    test(`${lang}: glass reviews are readable at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/${lang}/`);
      const reviews = page.locator('#customer-reviews');
      await expect(reviews).toHaveAttribute('data-ready', '');
      await reviews.scrollIntoViewIfNeeded();
      await expect(reviews.locator('[data-review-panel]:visible')).toHaveCount(width < 720 ? 3 : 1);
      await expect(reviews.locator('.reviews__selectors')).toBeVisible({ visible: width >= 720 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const bounds = await reviews.evaluate((el) => ({
        width: el.clientWidth,
        scroll: el.scrollWidth,
        outside: [...el.querySelectorAll('*')]
          .filter(
            (child) => child.getBoundingClientRect().right > el.getBoundingClientRect().right + 1,
          )
          .map((child) => child.getAttribute('class')),
      }));
      await reviews.screenshot({
        path: testInfo.outputPath(`reviews-${lang}-${width}.png`),
        animations: 'disabled',
        style: '.site-header, .hud { visibility: hidden !important; }',
      });
      expect(bounds.scroll, JSON.stringify(bounds)).toBeLessThanOrEqual(bounds.width);
      expect(
        (await new AxeBuilder({ page }).include('#customer-reviews').analyze()).violations,
      ).toEqual([]);
    });
  }

  test(`${lang}: all review text is available without JavaScript`, async ({ browser }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    await page.goto(`/${lang}/`);
    const reviews = page.locator('#customer-reviews');
    await expect(reviews.locator('[data-review-panel]:visible')).toHaveCount(3);
    await expect(reviews.locator('.reviews__selectors')).toBeHidden();
    await context.close();
  });
}

for (const width of [360, 900, 1440]) {
  test(`scroll visibly separates the glass layers at ${width}px, including touch devices`, async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      hasTouch: width < 1080,
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    await page.goto('/en/');
    const stage = page.locator('[data-review-stage]');
    await expect(page.locator('[data-reviews]')).toHaveAttribute('data-ready', '');
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await stage.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await expect
      .poll(() =>
        stage.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--review-scroll')),
      )
      .not.toBe('');
    const positions = () =>
      stage.evaluate((el) => {
        const y = (selector: string) =>
          el.querySelector(selector)!.getBoundingClientRect().top + scrollY;
        return {
          front: y('.reviews__quotes'),
          back: y('.reviews__plate--back'),
          middle: y('.reviews__plate--middle'),
          field: y('.reviews__field'),
        };
      });
    // Finishing finite transitions in the capture gives a settled initial transform for measurement.
    await page.screenshot({
      path: testInfo.outputPath(`parallax-${width}-before.png`),
      animations: 'disabled',
      style: '.site-header, .hud { visibility: hidden !important; }',
    });
    const before = await positions();
    await page.evaluate(() => window.scrollBy({ top: 320, behavior: 'instant' }));
    await expect
      .poll(async () => Math.abs((await positions()).front - before.front))
      .toBeGreaterThan(width < 720 ? 10 : 15);
    if (width >= 720) {
      await expect
        .poll(async () => {
          const after = await positions();
          return Math.abs(after.front - before.front - (after.back - before.back));
        })
        .toBeGreaterThan(30);
    }
    await expect
      .poll(async () => Math.abs((await positions()).field - before.field))
      .toBeGreaterThan(width < 720 ? 20 : 30);
    await page.screenshot({
      path: testInfo.outputPath(`parallax-${width}-after.png`),
      animations: 'disabled',
      style: '.site-header, .hud { visibility: hidden !important; }',
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await context.close();
  });
}

test('desktop tilt and scroll are bounded; changing reduced motion resets all movement', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/en/');
  const stage = page.locator('[data-review-stage]');
  await stage.scrollIntoViewIfNeeded();
  const box = (await stage.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.2);
  const value = (name: string) =>
    stage.evaluate(
      (el, key) => parseFloat((el as HTMLElement).style.getPropertyValue(key)) || 0,
      name,
    );
  await expect.poll(() => value('--review-ry')).toBeGreaterThan(1);
  expect(Math.abs(await value('--review-ry'))).toBeLessThanOrEqual(3);
  expect(Math.abs(await value('--review-rx'))).toBeLessThanOrEqual(3);
  const scroll = await value('--review-scroll');
  await page.mouse.wheel(0, 120);
  await expect.poll(() => value('--review-scroll')).not.toBe(scroll);
  expect(Math.abs(await value('--review-scroll'))).toBeLessThanOrEqual(48);
  expect(Math.abs(await value('--review-field'))).toBeLessThanOrEqual(100);
  await page.mouse.move(0, 0);
  await expect.poll(() => value('--review-ry')).toBe(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const key of [
    '--review-scroll',
    '--review-back',
    '--review-middle',
    '--review-field',
    '--review-rx',
    '--review-ry',
  ]) {
    await expect.poll(() => value(key)).toBe(0);
  }
  await expect(stage.locator('.reviews__scene')).toHaveCSS('transform', 'none');
  await page.locator('[data-review-select]').nth(2).click();
  await expect(page.locator('#review-soc')).toBeVisible();
});

test('responsive mode changes expose all mobile reviews and restore desktop selection', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/en/');
  await page.locator('[data-review-select]').nth(1).click();
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(page.locator('[data-review-panel]:visible')).toHaveCount(3);
  await expect(page.locator('[data-review-panel][aria-hidden]')).toHaveCount(0);
  await expect(page.locator('[data-review-panel][inert]')).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('[data-review-panel]:visible')).toHaveCount(1);
  await expect(page.locator('#review-audit')).toBeVisible();
});

test('review controls reinitialize after client-side navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/en/');
  await page.locator('.reviews__contact').click();
  await expect(page).toHaveURL(/\/en\/contact\/\?topic=other$/);
  await page.locator('header a[href="/en/"]').first().click();
  await expect(page.locator('[data-reviews]')).toHaveAttribute('data-ready', '');
  await page.locator('[data-review-select]').nth(1).click();
  await expect(page.locator('#review-audit')).toBeVisible();
  await expect(page.locator('[data-review-select][aria-pressed="true"]')).toHaveCount(1);
});
