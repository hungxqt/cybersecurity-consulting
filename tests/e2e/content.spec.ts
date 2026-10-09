import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const POST_SLUGS = readdirSync('src/content/posts/en')
  .filter((name) => /\.mdx?$/.test(name))
  .filter(
    (name) => !/^draft:\s*true\s*$/m.test(readFileSync(join('src/content/posts/en', name), 'utf8')),
  )
  .map((name) => name.replace(/\.mdx?$/, ''));
const DETAILS = POST_SLUGS.map((slug) => `blog/${slug}/`);
const publicationDates = new Map(
  POST_SLUGS.map((slug) => {
    const source = readFileSync(join('src/content/posts/en', `${slug}.mdx`), 'utf8');
    const date = source.match(/^date:\s*(\d{4}-\d{2}-\d{2})\s*$/m)?.[1];
    if (!date) throw new Error(`Missing publication date for ${slug}`);
    return [slug, new Date(date).toISOString()];
  }),
);

for (const lang of ['en', 'vi'] as const) {
  test.describe(`${lang} content`, () => {
    test(`/${lang}/blog/ lists all published entries`, async ({ page }) => {
      const hrefs: string[] = [];
      const dates: string[] = [];
      for (let current = 1; current <= Math.ceil(POST_SLUGS.length / 6); current++) {
        await page.goto(current === 1 ? `/${lang}/blog/` : `/${lang}/blog/page/${current}/`);
        await expect(page.locator('.rows .row')).toHaveCount(
          Math.min(6, POST_SLUGS.length - (current - 1) * 6),
        );
        hrefs.push(
          ...(await page
            .locator('.rows h3 a')
            .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href') ?? ''))),
        );
        dates.push(
          ...(await page
            .locator('.rows time')
            .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('datetime') ?? ''))),
        );
      }
      expect(hrefs.sort()).toEqual(POST_SLUGS.map((slug) => `/${lang}/blog/${slug}/`).sort());
      expect(new Set(dates).size).toBeGreaterThan(1);
      expect(dates).toEqual([...dates].sort().reverse());
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
        const slug = detail.split('/')[1]!;
        const published = publicationDates.get(slug)!;
        await expect(page.locator('.rail__meta time')).toHaveAttribute('datetime', published);
        const articleLd = await page
          .locator('script[type="application/ld+json"]')
          .allTextContents();
        expect(articleLd.join('')).toContain(`"datePublished":"${published}"`);
        expect(await page.locator('[data-prose]').innerText()).not.toContain('[VI]');
        if (await page.locator('[data-prose] a[href^="https://"]').count()) {
          await expect(page.locator('[data-prose] h2').first()).toHaveText(
            lang === 'vi' ? /^Góc nhìn HungTran:/ : /^Our assessment:/,
          );
          const switcher = page.locator('.lang-switch--bar');
          const other = lang === 'vi' ? 'en' : 'vi';
          await expect(switcher).toHaveAttribute('href', `/${other}/${detail}`);
        }
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

test('Vietnamese articles render translated titles, bodies and metadata', async ({ page }) => {
  await page.goto('/vi/blog/alert-queue-is-lying/');
  await expect(page.locator('h1')).toHaveText('Hàng đợi cảnh báo SOC đang đánh lừa bạn');
  await expect(
    page.getByRole('heading', { name: 'Giảm nhiễu thay vì chỉ nâng ngưỡng' }),
  ).toBeVisible();
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /Số lượng cảnh báo/,
  );
  expect(await page.content()).not.toContain('[VI]');
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.join('')).not.toContain('[VI]');
});
