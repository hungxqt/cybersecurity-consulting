import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

const ROUTES = [
  '',
  'solutions/',
  'solutions/consulting/',
  'solutions/audit/',
  'solutions/soc/',
  'about/',
  'experience/',
  'experience/journeys/vendor-account/',
  'experience/journeys/before-launch/',
  'experience/scenarios/logistics-soc-onboarding/',
  'blog/',
  'careers/',
  'resources/',
  'contact/',
  'design/',
];

for (const lang of ['en', 'vi'] as const) {
  test.describe(`${lang} shell`, () => {
    for (const route of ROUTES) {
      test(`/${lang}/${route} renders with correct lang and passes axe`, async ({ page }) => {
        await page.goto(`/${lang}/${route}`);
        await expect(page.locator('html')).toHaveAttribute('lang', lang);
        await expect(page.locator('h1').first()).toBeVisible();
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
          .analyze();
        expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
      });
    }
  });
}

test('root redirects to /en/', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/en\/$/);
});

test('hreflang alternates exist', async ({ page }) => {
  await page.goto('/en/solutions/soc/');
  await expect(page.locator('link[rel="alternate"][hreflang="vi"]')).toHaveAttribute(
    'href',
    /\/vi\/solutions\/soc\/$/,
  );
  await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
    'href',
    /\/en\/solutions\/soc\/$/,
  );
});

test('language switcher keeps the page', async ({ page }) => {
  await page.goto('/en/solutions/audit/');
  await page.getByRole('link', { name: /Switch to Tiếng Việt/ }).click();
  await expect(page).toHaveURL(/\/vi\/solutions\/audit\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
});

test('solutions menu works with the keyboard', async ({ page }) => {
  await page.goto('/en/');
  const button = page.getByRole('button', { name: 'Solutions' });
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Tab');
  await expect(
    page.locator('#solutions-menu').getByRole('link', { name: /^Consulting/ }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await expect(button).toBeFocused();
});

test('mobile menu opens and navigates', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/en/');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.locator('#mobile-menu').getByRole('link', { name: 'SOC' }).click();
  await expect(page).toHaveURL(/\/en\/solutions\/soc\/$/);
  await expect(page.locator('#mobile-menu')).toBeHidden();
});

test('skip link moves focus to main', async ({ page }) => {
  await page.goto('/en/about/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});

test('404 page renders', async ({ page }) => {
  const res = await page.goto('/vi/does-not-exist/');
  expect(res?.status()).toBe(404);
  await expect(page.locator('h1:visible')).toBeVisible();
});

const viDict = JSON.parse(readFileSync('src/i18n/vi.json', 'utf8')) as Record<string, string>;
const CONTACT_LABEL = { en: 'Contact', vi: viDict['nav.contact']! } as const;

async function expectNoHeaderOverflow(page: Page) {
  const sizes = await page.locator('[data-site-header]').evaluate((header) => {
    const bar = header.querySelector<HTMLElement>('.site-header__bar')!;
    const last = header.querySelector<HTMLElement>('.site-header__actions')!;
    return {
      headerScroll: header.scrollWidth,
      headerClient: header.clientWidth,
      barScroll: bar.scrollWidth,
      barClient: bar.clientWidth,
      actionsRight: last.getBoundingClientRect().right,
      barRight: bar.getBoundingClientRect().right,
    };
  });
  expect(sizes.headerScroll).toBeLessThanOrEqual(sizes.headerClient);
  expect(sizes.barScroll).toBeLessThanOrEqual(sizes.barClient);
  expect(sizes.actionsRight).toBeLessThanOrEqual(sizes.barRight + 0.5);
}

for (const [lang, width] of [
  ['en', 1080],
  ['vi', 1280],
] as const) {
  test(`full header fits without overflow at ${width}px on /${lang}/`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`/${lang}/`);
    await expect(page.locator('.primary-nav')).toBeVisible();
    await expect(page.locator('[data-burger]')).toBeHidden();
    await expectNoHeaderOverflow(page);
  });
}

for (const lang of ['en', 'vi'] as const) {
  test(`collapsed header fits at 360×740 on /${lang}/ and the language link moves into the menu`, async ({
    page,
  }) => {
    const other = lang === 'en' ? 'vi' : 'en';
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`/${lang}/`);
    await expectNoHeaderOverflow(page);

    const bar = page.locator('[data-site-header] .site-header__bar');
    await expect(bar.getByRole('link', { name: CONTACT_LABEL[lang], exact: true })).toBeVisible();
    await expect(page.locator('.lang-switch--bar')).toBeHidden();

    await page.locator('[data-burger]').click();
    const panelLinks = page.locator('#mobile-menu a');
    const first = panelLinks.first();
    await expect(first).toBeVisible();
    await expect(first).toHaveClass(/lang-switch/);
    await expect(first).toHaveAttribute('href', new RegExp(`^/${other}/$`));
    await expect(first).toHaveAttribute(
      'aria-label',
      (await page.locator('.lang-switch--bar').getAttribute('aria-label'))!,
    );
    await first.focus();
    await expect(first).toBeFocused();
    const box = await first.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
}
