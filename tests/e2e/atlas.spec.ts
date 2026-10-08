import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { GEOMETRY, LAYERS, bandBox, stripBox, type Breakpoint } from '../../src/lib/atlas';

const bpFor = (w: number): Breakpoint => (w >= 1080 ? 'lg' : w >= 720 ? 'md' : 'sm');
const URL = '/en/solutions/';

test('Identity is pressed before and after the script runs', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const nojs = await ctx.newPage();
  await nojs.goto(URL);
  const strip = nojs.locator('.atlas__strip[data-layer="identity"]');
  await expect(strip).toHaveAttribute('aria-pressed', 'true');
  await expect(strip).toHaveAttribute('tabindex', '0');
  await expect(nojs.locator('.atlas__strip[aria-pressed="true"]')).toHaveCount(1);
  await expect(nojs.locator('.atlas__plane[data-above]')).toHaveCount(2);
  await ctx.close();

  const page = await browser.newPage();
  await page.goto(URL);
  await page.waitForSelector('[data-atlas][data-live]');
  await expect(page.locator('.atlas__strip[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('.atlas__strip[data-layer="identity"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.close();
});

test('strip accessible names start with the visible text', async ({ page }) => {
  await page.goto(URL);
  await expect(page.getByRole('button', { name: 'Identity layer, 5 controls' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Operations layer, 4 controls' })).toBeVisible();
});

test('arrows move, Enter selects, the panel heading updates', async ({ page }) => {
  await page.goto(URL);
  await page.waitForSelector('[data-atlas][data-live]');
  const identity = page.locator('.atlas__strip[data-layer="identity"]');
  await identity.focus();
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('.atlas__strip[data-layer="edge"]')).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.locator('.atlas__strip[data-layer="data"]')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.locator('.atlas__strip[data-layer="operations"]')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator('.atlas__strip[data-layer="edge"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.atlas__strip[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('#atlas-panel h3:visible')).toHaveText('Edge');
});

test('control selection updates the detail and fills its marker', async ({ page }) => {
  await page.goto(URL);
  await page.waitForSelector('[data-atlas][data-live]');
  await page.getByRole('button', { name: 'Privileged access' }).click();
  await expect(page.locator('[data-detail="pam"]')).toBeVisible();
  await expect(page.locator('[data-detail="mfa"]')).toBeHidden();
  const fill = (id: string) =>
    page
      .locator(`.atlas__marker[data-control="${id}"]`)
      .evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(await fill('pam')).toBe('rgb(15, 76, 129)');
  expect(await fill('mfa')).not.toBe('rgb(15, 76, 129)');
});

test('lens radios switch the text; unengaged controls say not in scope', async ({ page }) => {
  await page.goto(URL);
  await page.waitForSelector('[data-atlas][data-live]');
  await page.getByLabel('SOC', { exact: true }).check();
  await page.getByRole('button', { name: 'Joiner / mover / leaver' }).click();
  await expect(
    page.locator('[data-detail="jml"]').getByText('Not in scope for this solution'),
  ).toBeVisible();
  await page.getByLabel('Audit', { exact: true }).check();
  await expect(page.locator('[data-detail="jml"]').getByText('Evidence we test')).toBeVisible();
});

for (const w of [1280, 800, 375]) {
  test(`clicking each band centre selects that layer at ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(URL);
    await page.waitForSelector('[data-atlas][data-live]');
    const bp = bpFor(w);
    const stage = page.locator('.atlas__stage');
    await stage.scrollIntoViewIfNeeded();
    expect(Math.round((await stage.boundingBox())!.height)).toBe(GEOMETRY[bp].stage);
    let sel = LAYERS.indexOf('identity');
    for (const target of [0, 4, 1, 3, 2]) {
      await page.waitForTimeout(350);
      const box = (await stage.boundingBox())!;
      const band = bandBox(target, sel, bp);
      await page.mouse.click(box.x + box.width * 0.2, box.y + box.height - band.centre);
      await expect(page.locator(`.atlas__strip[data-layer="${LAYERS[target]}"]`)).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      sel = target;
    }
    // The strip boxes match the shared constants once the transition settled.
    await page.waitForTimeout(350);
    const box = (await stage.boundingBox())!;
    for (let i = 0; i < LAYERS.length; i++) {
      const b = (await page.locator(`.atlas__strip[data-layer="${LAYERS[i]}"]`).boundingBox())!;
      const exp = stripBox(i, sel, bp);
      expect(Math.abs(box.y + box.height - exp.bottom - (b.y + b.height))).toBeLessThanOrEqual(1);
    }
  });
}

for (const [w, drawn] of [
  [1280, true],
  [900, true],
  [800, false],
  [375, false],
] as const) {
  test(`callout leader ${drawn ? 'is drawn' : 'is absent'} at ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(URL);
    await page.waitForSelector('[data-atlas][data-live]');
    await expect(page.locator('[data-leader]')).toHaveCount(drawn ? 1 : 0);
    if (drawn) {
      await page.getByRole('button', { name: 'Privileged access' }).click();
      await page.waitForTimeout(350);
      const [dot, marker] = await Promise.all([
        page.locator('.atlas__leader-dot').boundingBox(),
        page.locator('.atlas__marker[data-control="pam"]').boundingBox(),
      ]);
      const c = (b: { x: number; y: number; width: number; height: number }) => [
        b.x + b.width / 2,
        b.y + b.height / 2,
      ];
      const [dx, dy] = c(dot!);
      const [mx, my] = c(marker!);
      expect(Math.abs(dx! - mx!)).toBeLessThanOrEqual(2);
      expect(Math.abs(dy! - my!)).toBeLessThanOrEqual(2);
    }
  });
}

for (const w of [900, 720]) {
  test(`stage does not overflow at ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(URL);
    const o = await page
      .locator('.atlas__stage')
      .evaluate((e) => ({ s: e.scrollWidth, c: e.clientWidth }));
    expect(o.s).toBeLessThanOrEqual(o.c);
    const doc = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    expect(doc).toBe(true);
  });
}

test('panel height does not change with the selection', async ({ page }) => {
  await page.goto(URL);
  await page.waitForSelector('[data-atlas][data-live]');
  const h = () => page.locator('#atlas-panel').evaluate((e) => e.getBoundingClientRect().height);
  const before = await h();
  await page.locator('.atlas__strip[data-layer="data"]').click();
  await page.getByLabel('SOC', { exact: true }).check();
  expect(await h()).toBe(before);
});

test('table alternative lists all controls; solution pages show their column only', async ({
  page,
}) => {
  await page.goto(URL);
  await page.locator('.atlas__table summary').click();
  await expect(page.locator('.atlas__table tbody tr')).toHaveCount(21);
  await expect(page.locator('.atlas__table thead th')).toHaveCount(6);
  await page.goto('/en/solutions/soc/');
  await page.locator('.atlas__table summary').click();
  await expect(page.locator('.atlas__table thead th')).toHaveCount(3);
  await expect(page.locator('.atlas__lens-text[data-lens-text="audit"]')).toHaveCount(0);
  await expect(page.locator('input[name="atlas-lens"]')).toHaveCount(0);
});

test('solution sheets render the atlas theme with all sections', async ({ page }) => {
  for (const id of ['consulting', 'audit', 'soc']) {
    await page.goto(`/en/solutions/${id}/`);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'atlas');
    await expect(page.locator('[data-atlas]')).toHaveAttribute('data-lens', id);
    await expect(page.locator('ol.method li')).toHaveCount(5);
    await expect(page.getByRole('heading', { name: 'Implementation process' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Technical documentation' })).toBeVisible();
  }
});

test('axe passes on the solutions pages', async ({ page }) => {
  for (const p of [
    '/en/solutions/',
    '/en/solutions/consulting/',
    '/en/solutions/audit/',
    '/en/solutions/soc/',
    '/vi/solutions/',
  ]) {
    await page.goto(p);
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
    expect(r.violations.map((v) => `${p} ${v.id}`)).toEqual([]);
  }
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('selection still works and the leader appears without drawing', async ({ page }) => {
    await page.goto(URL);
    await page.waitForSelector('[data-atlas][data-live]');
    await page.locator('.atlas__strip[data-layer="edge"]').click();
    await expect(page.locator('#atlas-panel h3:visible')).toHaveText('Edge');
    await expect(page.locator('[data-leader] .atlas__leader[data-draw]')).toHaveCount(0);
    await expect(page.locator('.atlas__strip[aria-pressed="true"]')).toHaveCount(1);
  });
});
