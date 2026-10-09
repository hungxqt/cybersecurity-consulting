import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const lang of ['en', 'vi'] as const) {
  for (const width of [360, 1280]) {
    test(`${lang}: pagination lands at the article section without a document reload at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/${lang}/blog/`);
      await page.evaluate(() => {
        (window as unknown as { paginationSession: string }).paginationSession = 'preserved';
      });
      for (const label of ['a[rel="next"]', 'a[rel="next"]', 'a[rel="prev"]', 'a[rel="prev"]']) {
        await page.locator(`.pagination ${label}`).click();
        await expect(page).toHaveURL(/#articles$/);
        await expect
          .poll(() =>
            page.evaluate(() => {
              const top = document.querySelector('#articles')!.getBoundingClientRect().top;
              const headerBottom = document.querySelector('header')!.getBoundingClientRect().bottom;
              return top >= headerBottom && top <= headerBottom + 32;
            }),
          )
          .toBe(true);
        expect(
          await page.evaluate(
            () => (window as unknown as { paginationSession: string }).paginationSession,
          ),
        ).toBe('preserved');
        expect(
          await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior),
        ).toBe('auto');
      }
    });
  }

  test(`${lang}: pagination navigates, preserves language, and supports history`, async ({
    page,
  }) => {
    await page.goto(`/${lang}/blog/`);
    const pager = page.locator('.pagination');
    await expect(pager.locator('[aria-current="page"]')).toHaveText('1');
    await expect(pager.locator('[aria-disabled="true"]')).toHaveText(
      lang === 'vi' ? 'Trang trước' : 'Previous',
    );
    await pager.locator('a[rel="next"]').click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/blog/page/2/#articles$`));
    await expect(page.locator('.rows .row')).toHaveCount(6);
    await expect(pager.locator('[aria-current="page"]')).toHaveText('2');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://hungtran.id.vn/${lang}/blog/page/2/`,
    );
    const other = lang === 'vi' ? 'en' : 'vi';
    await expect(page.locator('.lang-switch--bar')).toHaveAttribute(
      'href',
      `/${other}/blog/page/2/`,
    );
    await pager.locator('a[rel="next"]').click();
    await expect(page.locator('.rows .row')).toHaveCount(3);
    await expect(pager.locator('[aria-current="page"]')).toHaveText('3');
    await expect(pager.locator('a[rel="next"]')).toHaveCount(0);
    await page.goBack();
    await expect(pager.locator('[aria-current="page"]')).toHaveText('2');
    await pager.locator('a[rel="prev"]').click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/blog/#articles$`));
  });

  test(`${lang}: all listing pages are accessible and fit mobile`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    for (const path of [`/${lang}/blog/`, `/${lang}/blog/page/2/`, `/${lang}/blog/page/3/`]) {
      await page.goto(path);
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
        .analyze();
      expect(result.violations.map((v) => v.id)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
  });
}

test('page links work without JavaScript and nonexistent pages return 404', async ({
  browser,
  request,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL: test.info().project.use.baseURL,
  });
  const page = await context.newPage();
  try {
    await page.goto('/vi/blog/');
    await page.locator('.pagination a[rel="next"]').click();
    await expect(page).toHaveURL(/\/vi\/blog\/page\/2\/#articles$/);
    await expect(page.locator('.rows .row')).toHaveCount(6);
  } finally {
    await context.close();
  }
  expect((await request.get('/en/blog/page/99/')).status()).toBe(404);
});
