import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ROW1 = /^\d{2}:\d{2}:\d{2} · [a-z0-9-]+$/;
const ROW2 = /^[A-Z]{3} › (blocked|contained|escalated) · \d+ms$/;
const IDS = [
  'phish', 'stuffing', 'recon', 'ransom', 'mailgw', 'vpn', 'webapp',
  'edr', 'laptops', 'idp', 'siem', 'api', 'data', 'backups',
]; // prettier-ignore

async function live(page: Page, url = '/en/') {
  await page.goto(url);
  await expect(page.locator('[data-nexus]')).toHaveAttribute('data-live', '', { timeout: 15_000 });
}
const node = (page: Page, id: string) => page.locator(`[data-node="${id}"]`);
const card = (page: Page, id: string) => page.locator(`[data-card="${id}"]`);

test('hero text, graph and keyboard operation', async ({ page }) => {
  await live(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('graphs');
  await expect(card(page, 'intro')).toBeVisible();

  await node(page, 'idp').focus();
  await page.keyboard.press('ArrowRight');
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-node'));
  expect(focused).toBe('data');
  await expect(card(page, 'data')).toBeVisible();
  await expect(card(page, 'intro')).toBeHidden();

  await page.keyboard.press('Enter');
  await expect(node(page, 'data')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(node(page, 'data')).toHaveAttribute('aria-pressed', 'false');
  await expect(card(page, 'intro')).toBeVisible();

  await page.keyboard.press('Home');
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-node'))).toBe(
    'phish',
  );
  await page.keyboard.press('End');
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-node'))).toBe(
    'backups',
  );
});

test('pinning a second node unpins the first', async ({ page }) => {
  await live(page);
  await node(page, 'vpn').click();
  await node(page, 'idp').click();
  await expect(node(page, 'vpn')).toHaveAttribute('aria-pressed', 'false');
  await expect(node(page, 'idp')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[aria-pressed="true"][data-node]')).toHaveCount(1);
  await node(page, 'idp').click();
  await expect(node(page, 'idp')).toHaveAttribute('aria-pressed', 'false');
});

test('preview persists from a node through the lens group to a Covered-by link', async ({
  page,
}) => {
  await live(page);
  await node(page, 'idp').focus();
  await expect(card(page, 'idp')).toBeVisible();
  await page.keyboard.press('Tab'); // lens radios
  await expect(page.locator('input[name="nexus-lens"]:checked')).toBeFocused();
  await expect(card(page, 'idp')).toBeVisible();
  await page.keyboard.press('Tab');
  const link = card(page, 'idp').getByRole('link').first();
  await expect(link).toBeFocused();
  await expect(link).toBeVisible();
  await expect(card(page, 'idp')).toBeVisible();
  await expect(card(page, 'intro')).toBeHidden();
});

test('intro card, lens group name, table and pause', async ({ page }) => {
  await live(page);
  await expect(page.locator('dl.nx-legend dd')).toHaveCount(5);
  await expect(page.getByRole('group', { name: 'View by solution' })).toBeVisible();
  await page.getByLabel('SOC', { exact: true }).check();
  await expect(page.locator('.nexus__stage')).toHaveAttribute('data-lens', 'soc');

  await page.locator('.nexus__table summary').click();
  await expect(page.locator('.nexus__table tbody tr')).toHaveCount(14);

  const root = page.locator('[data-nexus]');
  await expect(root).toHaveAttribute('data-ambient', 'on');
  const btn = page.locator('[data-ambient-toggle]');
  await btn.click();
  await expect(root).toHaveAttribute('data-ambient', 'off');
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await btn.click();
  await expect(root).toHaveAttribute('data-ambient', 'on');
});

test('event log rows follow the format and never overflow at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await live(page);
  const rows = page.locator('[data-log] li');
  await expect(rows).toHaveCount(6);
  const texts = await rows.allTextContents();
  texts.forEach((t, i) => expect(t).toMatch(i % 2 === 0 ? ROW1 : ROW2));
  const overflow = await rows.evaluateAll((els) => els.some((e) => e.scrollWidth > e.clientWidth));
  expect(overflow).toBe(false);
  await page.waitForTimeout(3200); // one live event arrives and keeps 6 rows
  await expect(rows).toHaveCount(6);
  const live2 = await rows.allTextContents();
  live2.forEach((t, i) => expect(t).toMatch(i % 2 === 0 ? ROW1 : ROW2));
});

test('DOM order is stage, lens, panel, log, controls', async ({ page }) => {
  await live(page);
  const order = await page.evaluate(() =>
    [...document.querySelector('.nexus')!.children].map((c) => c.className.split(' ')[0]),
  );
  expect(order).toEqual([
    'nexus__stage',
    'nexus__lens',
    'nexus__panel',
    'nexus__log',
    'nexus__controls',
  ]);
});

test('mobile first viewport shows the graph (360x740)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await live(page);
  const top = await page.locator('.nexus__stage').evaluate((e) => e.getBoundingClientRect().top);
  expect(top).toBeLessThanOrEqual(740 - 96);
});

test('tall stage is capped at 26rem (640x900)', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 900 });
  await live(page);
  const h = await page.locator('.nexus__stage').evaluate((e) => e.clientHeight);
  expect(h).toBeLessThanOrEqual(832);
});

for (const [w, h, layout] of [
  [1440, 900, 'wide'],
  [360, 740, 'tall'],
] as const) {
  test(`mark centres sit on the data-${layout} coordinates at ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await live(page);
    const bad = await page.evaluate(
      ([attr = 'wide']) => {
        const stage = document.querySelector('.nexus__stage')!.getBoundingClientRect();
        const vb = attr === 'wide' ? [1000, 600] : [600, 1200];
        const out: string[] = [];
        document.querySelectorAll<HTMLElement>('[data-node]').forEach((n) => {
          const [x, y] = n.dataset[attr]!.split(' ').map(Number);
          const m = n.querySelector('.nx-node__mark')!.getBoundingClientRect();
          const dx = m.left + m.width / 2 - (stage.left + (x! / vb[0]!) * stage.width);
          const dy = m.top + m.height / 2 - (stage.top + (y! / vb[1]!) * stage.height);
          if (Math.abs(dx) > 1 || Math.abs(dy) > 1)
            out.push(`${n.dataset.node}:${dx.toFixed(1)},${dy.toFixed(1)}`);
        });
        return out;
      },
      [layout],
    );
    expect(bad).toEqual([]);
  });
}

for (const lang of ['en', 'vi']) {
  for (const w of [360, 720, 1080, 1440]) {
    test(`cards fit the panel at ${w}px (${lang})`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      await live(page, `/${lang}/`);
      const bad = await page.evaluate((ids) => {
        const panel = document.querySelector<HTMLElement>('.nexus__panel')!;
        const out: string[] = [];
        for (const id of ['intro', ...ids]) {
          document
            .querySelectorAll<HTMLElement>('[data-card]')
            .forEach((c) => (c.hidden = c.dataset.card !== id));
          const art = document.querySelector<HTMLElement>(`[data-card="${id}"]`)!;
          const pr = panel.getBoundingClientRect();
          if (art.scrollHeight > panel.clientHeight) out.push(`${id} height`);
          art.querySelectorAll('a').forEach((a) => {
            const r = a.getBoundingClientRect();
            if (r.top < pr.top || r.bottom > pr.bottom || r.right > pr.right)
              out.push(`${id} link`);
          });
        }
        return out;
      }, IDS);
      expect(bad).toEqual([]);
    });
  }
}

test('axe finds no violations on the home hero', async ({ page }) => {
  await live(page);
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('stays static: no ambient, 6 rows, no pause button, 14 table rows', async ({ page }) => {
    await live(page);
    await page.waitForTimeout(2800);
    await expect(page.locator('[data-nexus]')).toHaveAttribute('data-ambient', 'off');
    await expect(page.locator('[data-log] li')).toHaveCount(6);
    await expect(page.locator('[data-ambient-toggle]')).toBeHidden();
    await page.locator('.nexus__table summary').click();
    await expect(page.locator('.nexus__table tbody tr')).toHaveCount(14);
  });
});
