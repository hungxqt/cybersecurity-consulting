import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
const keys = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
];
async function activate(page: Page) {
  for (const key of keys) await page.keyboard.press(key);
  await expect(page.getByRole('dialog', { name: 'Synthetic defence console' })).toBeVisible();
}
async function setup(page: Page) {
  await page.clock.install();
  await page.goto('/en/');
  await page.waitForLoadState('networkidle');
}
test('lazy loading, timeline, inspection, commands and reveal', async ({ page }, info) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await setup(page);
  expect(requests.some((u) => /matrix\.|\/matrix\//.test(u))).toBe(false);
  const chunks: Promise<{ size: number; type: string }>[] = [];
  page.on('response', (r) => {
    if (r.url().includes('/_astro/'))
      chunks.push(
        r.body().then((b) => ({ size: gzipSync(b).length, type: r.request().resourceType() })),
      );
  });
  await activate(page);
  await page.clock.runFor(7500);
  await expect(page.locator('.mx')).toHaveAttribute('data-matrix-phase', 'recon');
  await expect(page.locator('.mx-logs')).toContainText('SYNTHETIC SECURE CHANNEL');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.clock.runFor(30000);
  await expect(page.locator('.mx')).toHaveAttribute('data-matrix-phase', 'recon');
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.clock.runFor(6000);
  await page.screenshot({ path: info.outputPath('matrix-recon.png') });
  await page.locator('[data-node-id="DB-01"]').click();
  await expect(page.locator('.mx-detail')).toContainText('DB-01');
  const canvas = page.locator('.mx-network');
  const points = JSON.parse((await canvas.getAttribute('data-node-coordinates'))!) as {
    id: string;
    x: number;
    y: number;
  }[];
  const point = points.find((p) => p.id === 'SRV-01')!;
  await canvas.click({ position: { x: point.x, y: point.y } });
  await expect(page.locator('.mx-detail')).toContainText('SRV-01');
  await page.getByLabel('Command', { exact: true }).fill('help');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.clock.runFor(2000);
  await expect(page.locator('.mx-logs')).toContainText('inspect <ID>');
  await page.clock.runFor(25000);
  await expect(page.locator('.mx')).toHaveAttribute('data-matrix-phase', 'reveal');
  await expect(page.getByRole('heading', { name: 'ACCESS TO THE MATRIX: GRANTED' })).toBeVisible();
  expect(await page.locator('.mx-stages [data-done]').count()).toBe(6);
  await expect(page.locator('.mx-detail')).toContainText('contained');
  await expect(page.locator('.mx-grid')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Return to site' })).toBeInViewport();
  await page.screenshot({ path: info.outputPath('matrix-reveal.png') });
  expect(
    (await Promise.all(chunks)).filter((c) => c.type === 'script').reduce((s, c) => s + c.size, 0),
  ).toBeLessThanOrEqual(25600);
  await page.locator('.mx-controls').getByRole('button', { name: 'Replay' }).click();
  await expect(page.locator('.mx')).toHaveAttribute('data-matrix-phase', 'init');
  await page.keyboard.press('Escape');
  await expect(page.locator('.mx')).toHaveCount(0);
  await expect(page.locator('[data-matrix-style]')).toHaveCount(0);
  expect(await page.locator('[inert]').count()).toBe(0);
});
test('logo activation works on desktop and touch viewport', async ({ page }) => {
  await setup(page);
  for (const mobile of [false, true]) {
    if (mobile) await page.setViewportSize({ width: 390, height: 800 });
    for (let i = 0; i < 5; i++) await page.locator('header .logo').click({ noWaitAfter: true });
    await expect(page.locator('.mx')).toHaveCount(1);
    await page.getByRole('button', { name: 'Close ×' }).click();
    await expect(page.locator('header .logo')).toBeFocused();
  }
});
test('reduced motion, mobile accessibility and contact navigation', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page);
  await activate(page);
  await page.clock.runFor(39000);
  await expect(page.locator('.mx-glitch')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Close ×' })).toBeInViewport();
  expect(await page.locator('.mx').evaluate((n) => n.scrollWidth <= n.clientWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).include('.mx').analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath('matrix-mobile.png') });
  await page.getByRole('link', { name: 'Talk to the team →' }).click();
  await expect(page).toHaveURL(/\/en\/contact\/$/);
  await expect(page.locator('.mx')).toHaveCount(0);
});
test('typing does not activate; singleton and repeated cleanup', async ({ page }) => {
  await setup(page);
  await page.goto('/en/contact/');
  const field = page.locator('input[type="text"]').first();
  await field.focus();
  for (const key of keys) await page.keyboard.press(key);
  await expect(page.locator('.mx')).toHaveCount(0);
  await field.blur();
  for (let i = 0; i < 10; i++) {
    await activate(page);
    await activate(page);
    await expect(page.locator('.mx')).toHaveCount(1);
    await page.getByRole('button', { name: 'Close ×' }).click();
    await expect(page.locator('.mx,[data-matrix-style],[inert]')).toHaveCount(0);
  }
});
test('Escape during loading cancels mounting', async ({ page }) => {
  await setup(page);
  await page.route(/matrix.*\.css/, async (route) => {
    await page.keyboard.press('Escape');
    await route.continue();
  });
  for (const key of keys) await page.keyboard.press(key);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.mx,[data-matrix-style]')).toHaveCount(0);
});
test('production CSP, no external requests and text fallback', async ({ page }) => {
  const policy = readFileSync('public/_headers', 'utf8')
    .match(/Content-Security-Policy: (.+)/)![1]!
    .trim();
  await page.route('**/*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'content-security-policy': policy },
    });
  });
  await page.addInitScript(() => {
    const w = window as unknown as { violations: string[] };
    w.violations = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      w.violations.push(e.violatedDirective),
    );
    HTMLCanvasElement.prototype.getContext = (() =>
      null) as typeof HTMLCanvasElement.prototype.getContext;
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await setup(page);
  await page.goto('/vi/contact/');
  await page.waitForLoadState('networkidle');
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await activate(page);
  await page.clock.runFor(38000);
  await expect(page.locator('.mx')).toContainText('Text mode active');
  expect(await page.locator('[data-node-id]').count()).toBeGreaterThanOrEqual(8);
  expect(
    await page.evaluate(() => (window as unknown as { violations: string[] }).violations),
  ).toEqual([]);
  expect(errors).toEqual([]);
  expect(
    requests.every(
      (u) =>
        new URL(u).origin === new URL(page.url()).origin &&
        new URL(u).pathname.startsWith('/_astro/'),
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Return to site' }).click();
  await expect(page.locator('.mx')).toHaveCount(0);
});
test('terminal exit and navigation dispose the overlay', async ({ page }) => {
  await setup(page);
  await activate(page);
  await page.clock.runFor(8000);
  await page.getByLabel('Command', { exact: true }).fill('exit');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.locator('.mx,[data-matrix-style],[inert]')).toHaveCount(0);
  await activate(page);
  await page.evaluate(() => document.dispatchEvent(new Event('astro:before-swap')));
  await expect(page.locator('.mx,[data-matrix-style],[inert]')).toHaveCount(0);
});
test('touch logo activation and keyboard node inspection', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 800 },
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await setup(page);
    for (let i = 0; i < 5; i++) await page.locator('footer .logo').tap();
    await expect(page.locator('.mx')).toHaveCount(1);
    await page.clock.runFor(9000);
    await page.locator('.mx-index summary').click();
    const first = page.locator('[data-node-id]').first();
    await first.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(page.locator('.mx-detail')).toContainText('FW-01');
    await page.keyboard.press('Escape');
    await expect(page.locator('footer .logo')).toBeFocused();
  } finally {
    await context.close();
  }
});
test('animation callbacks stop on pause, hidden tab and close', async ({ page }) => {
  await setup(page);
  await page.goto('/en/contact/');
  await page.evaluate(() => {
    const w = window as unknown as { matrixFrames: Set<number> };
    w.matrixFrames = new Set();
    const request = window.requestAnimationFrame.bind(window),
      cancel = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      const id = request((time) => {
        w.matrixFrames.delete(id);
        callback(time);
      });
      w.matrixFrames.add(id);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      w.matrixFrames.delete(id);
      cancel(id);
    };
  });
  const pending = () =>
    page.evaluate(() => (window as unknown as { matrixFrames: Set<number> }).matrixFrames.size);
  await activate(page);
  await page.clock.runFor(1000);
  expect(await pending()).toBe(1);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  expect(await pending()).toBe(0);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  expect(await pending()).toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(await pending()).toBe(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(await pending()).toBe(1);
  await page.keyboard.press('Escape');
  expect(await pending()).toBe(0);
});
test('controls and sparse topology stay inside their panels at every breakpoint', async ({
  page,
}, info) => {
  await setup(page);
  await activate(page);
  await page.clock.runFor(11000);
  expect(await page.locator('[data-node-id]').count()).toBeLessThanOrEqual(12);
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.clock.runFor(200);
    const layout = await page.locator('.mx').evaluate((root) => {
      const header = root.querySelector('.mx-header')!.getBoundingClientRect();
      const buttons = Array.from(root.querySelectorAll('.mx-controls button')).map((b) =>
        b.getBoundingClientRect(),
      );
      const canvas = root.querySelector<HTMLCanvasElement>('.mx-network')!;
      const bounds = canvas.getBoundingClientRect();
      const points = JSON.parse(canvas.dataset.nodeCoordinates!) as { x: number; y: number }[];
      return {
        overflow: root.scrollWidth > root.clientWidth,
        controlsFit: buttons.every(
          (b) =>
            b.left >= header.left &&
            b.right <= header.right &&
            b.top >= header.top &&
            b.bottom <= header.bottom,
        ),
        controlsOverlap: buttons.some((b, i) => i > 0 && b.left < buttons[i - 1]!.right),
        nodesFit: points.every(
          (p) => p.x >= 24 && p.x <= bounds.width - 24 && p.y >= 24 && p.y <= bounds.height - 24,
        ),
      };
    });
    expect(layout, `Layout at ${width}px`).toEqual({
      overflow: false,
      controlsFit: true,
      controlsOverlap: false,
      nodesFit: true,
    });
    await page.locator('.mx').evaluate((root) => (root.scrollTop = 500));
    await expect(page.getByRole('button', { name: 'Close ×' })).toBeInViewport();
    await page.locator('.mx').evaluate((root) => (root.scrollTop = 0));
    await page.screenshot({ path: info.outputPath(`matrix-layout-${width}.png`) });
  }
});
