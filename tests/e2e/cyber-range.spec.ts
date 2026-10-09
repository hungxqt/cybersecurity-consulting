import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { RANGE_LABS } from '../../src/lib/rangeCatalog';
import { rangeCopy } from '../../src/lib/rangeCopy';

test.beforeEach(async ({ page, baseURL }) => {
  const lines = readFileSync('public/_headers', 'utf8')
    .split(/\n\s*\n/)[0]!
    .split('\n');
  const headers: Record<string, string> = {};
  for (const line of lines.slice(1)) {
    const i = line.indexOf(':');
    if (i > 0) headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  await page.route(`${baseURL}/**`, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), ...headers } });
  });
  await page.addInitScript(() => {
    const violations: string[] = [];
    Object.assign(window, { rangeCsp: violations });
    document.addEventListener('securitypolicyviolation', (e) =>
      violations.push(e.violatedDirective),
    );
  });
});
const visit = async (page: Page, id: string, lang = 'en') => {
  await page.goto(`/${lang}/experience/labs/${id}/`);
  await expect(page.locator('[data-range]')).toHaveAttribute('data-ready', 'true');
};
const command = async (page: Page, text: string) => {
  await page.locator('[data-command]').fill(text);
  await page.locator('[data-command]').press('Enter');
};

for (const lang of ['en', 'vi'] as const) {
  const c = rangeCopy(lang);
  test(`${lang}: all eight immersive routes support accessibility, client navigation and CSP`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`/${lang}/experience/`);
    await expect(page.locator('#labs a')).toHaveCount(14);
    for (const lab of RANGE_LABS) {
      await page.locator(`a[href='/${lang}/experience/labs/${lab.id}/']`).first().click();
      await expect(page.locator('[data-range]')).toHaveAttribute('data-ready', 'true');
      await expect(page.locator('.lab-nodes, .lab-table')).toHaveCount(0);
      const scan = await new AxeBuilder({ page })
        .include('[data-lab]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(
        scan.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(',')}`),
        lab.id,
      ).toEqual([]);
      expect(
        await page.evaluate(() => (window as unknown as { rangeCsp: string[] }).rangeCsp),
        lab.id,
      ).toEqual([]);
    }
    expect(errors).toEqual([]);
  });
  test(`${lang}: digital twin and terminal change the same network`, async ({ page }) => {
    await visit(page, 'network-digital-twin', lang);
    await page.locator('[data-launch]').click();
    await expect(page.locator('[data-range-findings]')).toContainText(c.attackOpen);
    await command(page, 'enable mfa');
    await expect(page.locator('[data-range-toggle="mfa"]')).toBeChecked();
    await expect(page.locator('[data-range-findings]')).toContainText(c.attackStopped);
    await page.locator('[data-option="entry"]').selectOption('attachment');
    await expect(page.locator('[data-range-findings]')).toContainText(c.attackOpen);
    await command(page, 'isolate WS-17');
    await expect(page.locator('[data-range-findings]')).toContainText(c.attackStopped);
    await page.locator('[data-range-reset]').click();
    await expect(page.locator('[data-range-findings]')).toContainText(c.idle);
    await visit(page, 'response-terminal', lang);
    await command(page, 'inspect WS-17');
    await expect(page.locator('[data-terminal-log]')).toContainText(c.terminalEvidence);
    await page.locator('[data-command]').press('ArrowUp');
    await expect(page.locator('[data-command]')).toHaveValue('inspect WS-17');
    await page.locator('[data-command]').fill('iso');
    await page.locator('[data-command]').press('Tab');
    await expect(page.locator('[data-command]')).toHaveValue('isolate WS-17');
    await page.locator('[data-command]').press('Enter');
    await expect(page.locator('[data-range-findings]')).toContainText(c.attackStopped);
    await command(page, '<img src=x onerror=alert(1)>');
    await expect(page.locator('[data-terminal-log] img')).toHaveCount(0);
    await expect(page.locator('[data-terminal-log]')).toContainText(c.unknown);
  });
  test(`${lang}: DDoS queues grow, drain and expose legitimate rejection`, async ({ page }) => {
    await visit(page, 'ddos-defense', lang);
    await page.locator('[data-range-next]').click();
    await expect(page.locator('[data-range-metrics]')).toContainText('400');
    await command(page, 'filter on');
    await command(page, 'cache 80');
    await page.locator('[data-range-next]').click();
    await expect(page.locator('[data-range-metrics]')).toContainText('280');
    await expect(page.locator('[data-range-findings]')).toContainText(c.balanced);
    await page.locator('[data-range-input="rate"]').focus();
    await page.keyboard.press('Home');
    const rejected = page
      .locator('[data-range-metrics] dl')
      .filter({ has: page.getByText(c.rejected, { exact: true }) });
    await expect(rejected.locator('dd')).not.toHaveText('0');
    await page.locator('[data-range-play]').click();
    await expect(page.locator('[data-range]')).toHaveAttribute('data-running', 'true');
    await page.locator('[data-range-play]').click();
    await expect(page.locator('[data-range]')).toHaveAttribute('data-running', 'false');
  });
  test(`${lang}: ransomware containment and recovery follow one wave at a time`, async ({
    page,
  }) => {
    await visit(page, 'ransomware-race', lang);
    await page.locator('[data-isolate]').click();
    await page.locator('[data-range-next]').click();
    const affected = page
      .locator('[data-range-metrics] dl')
      .filter({ has: page.getByText(c.affected, { exact: true }) });
    await expect(affected.locator('dd')).toHaveText('1');
    await page.locator('[data-restore]').click();
    await expect(page.locator('[data-range-findings]')).toContainText(c.restoreDone);
    await expect(affected.locator('dd')).toHaveText('0');
    await page.locator('[data-range-reset]').click();
    await page.locator('[data-range-toggle="backups"]').uncheck();
    for (let i = 0; i < 3; i++) await page.locator('[data-range-next]').click();
    await expect(page.locator('[data-range-findings]')).toContainText(c.lostBackup);
  });
  test(`${lang}: packet rules and zero-trust checkpoints explain decisions`, async ({ page }) => {
    await visit(page, 'packet-workbench', lang);
    await page.locator('[data-range-packet="1"]').click();
    await expect(page.locator('[data-range-findings]')).toContainText(c.patternBlocked);
    await page.locator('[data-range-toggle="inspectRule"]').uncheck();
    await expect(page.locator('[data-range-findings]')).toContainText(c.packetAllow);
    await page.locator('[data-range-packet="2"]').click();
    await expect(page.locator('[data-range-findings]')).toContainText(c.sourceBlocked);
    await page.locator('[data-range-toggle="sourceRule"]').uncheck();
    await expect(page.locator('[data-range-findings]')).toContainText(c.portBlocked);
    await expect(page.locator('[data-layer="transport"]')).toContainText('8080');
    await visit(page, 'zero-trust-journey', lang);
    await expect(page.locator('[data-range-findings]')).toContainText(c.accessAllow);
    await page.locator('[data-option="resource"]').selectOption('console');
    await expect(page.locator('[data-range-findings]')).toContainText(c.resourceDeny);
    await page.locator('[data-option="role"]').selectOption('administrator');
    await expect(page.locator('[data-range-findings]')).toContainText(c.accessAllow);
    await page.locator('[data-range-toggle="verified"]').uncheck();
    await expect(page.locator('[data-range-findings]')).toContainText(c.identityDeny);
  });
  test(`${lang}: replay panels share a clock and cloud permissions preserve alternate paths`, async ({
    page,
  }) => {
    await visit(page, 'soc-replay', lang);
    await page.locator('[data-frame]').focus();
    await page.keyboard.press('End');
    await expect(page.locator('[data-replay-log]')).toContainText('10:06');
    await expect(page.locator('[data-range-next]')).toBeDisabled();
    await page.locator('[data-option="viewpoint"]').selectOption('business');
    await expect(page.locator('[data-range-findings]')).toContainText(
      c.businessNotes.split('|')[5]!,
    );
    await page.locator('[data-range-previous]').click();
    await expect(page.locator('[data-replay-log]')).toContainText('09:28');
    await visit(page, 'cloud-blast-radius', lang);
    const count = page
      .locator('[data-range-metrics] dl')
      .filter({ has: page.getByText(c.blastCount, { exact: true }) })
      .locator('dd');
    await expect(count).toHaveText('5');
    await page.locator('[data-permission="assume"]').uncheck();
    await expect(count).toHaveText('2');
    await page.locator('[data-permission="invoke"]').uncheck();
    await expect(count).toHaveText('0');
    await page.locator('[data-option="principal"]').selectOption('service');
    await expect(count).toHaveText('2');
  });
}
for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`traffic particles move on explicit opt-in and stop when disabled (${reducedMotion})`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion });
    for (const id of ['network-digital-twin', 'cloud-blast-radius']) {
      await visit(page, id);
      const canvas = page.locator('[data-range-scene] canvas');
      await expect(canvas).toBeVisible();
      await expect(page.locator('input[data-motion]')).not.toBeChecked();
      await page.locator('input[data-motion]').check();
      await canvas.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const first = await canvas.screenshot();
      await page.waitForTimeout(350);
      expect((await canvas.screenshot()).equals(first), `${id}: enabled traffic must move`).toBe(
        false,
      );
      await page.locator('input[data-motion]').uncheck();
      await canvas.scrollIntoViewIfNeeded();
      const stopped = await canvas.screenshot();
      await page.waitForTimeout(350);
      expect((await canvas.screenshot()).equals(stopped), `${id}: disabled traffic must stop`).toBe(
        true,
      );
    }
    await visit(page, 'packet-workbench');
    const packet = page.locator('.range-flow').first();
    await expect(page.locator('input[data-motion]')).not.toBeChecked();
    await page.locator('input[data-motion]').check();
    await expect(page.locator('[data-range-scene]')).toHaveAttribute('data-motion', 'true');
    await expect(packet).toHaveCSS('animation-name', 'range-flight');
    const position = await packet.evaluate((el) => getComputedStyle(el).transform);
    await page.waitForTimeout(350);
    expect(await packet.evaluate((el) => getComputedStyle(el).transform)).not.toBe(position);
    await page.locator('input[data-motion]').uncheck();
    await expect(packet).toHaveCSS('animation-name', 'none');
  });
}

test('real 3D camera, node selection and context-loss fallback remain operable', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await visit(page, 'network-digital-twin');
  await expect(page.locator('[data-range-scene]')).toHaveAttribute('data-renderer', 'webgl');
  await expect(page.locator('[data-range-scene] canvas')).toBeVisible();
  await page.locator('[data-camera="left"]').click();
  const camera = await page.locator('[data-range-scene]').getAttribute('data-camera');
  await page.locator('[data-camera="right"]').click();
  expect(await page.locator('[data-range-scene]').getAttribute('data-camera')).not.toBe(camera);
  await page.locator('[data-system="db"]').click();
  await expect(page.locator('[data-system="db"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-range-scene] canvas').evaluate((canvas) => {
    (canvas as HTMLCanvasElement)
      .getContext('webgl2')!
      .getExtension('WEBGL_lose_context')!
      .loseContext();
  });
  await expect(page.locator('[data-range-scene]')).toHaveAttribute('data-renderer', 'svg');
  await page.locator('[data-launch]').click();
  await expect(page.locator('[data-range-findings]')).toContainText(rangeCopy('en').attackOpen);
  await page.locator('[data-range-toggle="mfa"]').check();
  await expect(page.locator('[data-range-scene] svg')).toHaveAttribute('aria-label', /Blocked/);
  await page.getByRole('link', { name: 'All Experience labs' }).click();
  expect(errors).toEqual([]);
});
test('WebGL initialization failure still provides an interactive diagram', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
        if (/^webgl/.test(type)) return null;
        return Reflect.apply(original, this, [type, ...args]);
      },
    });
  });
  await visit(page, 'network-digital-twin');
  await expect(page.locator('[data-range-scene]')).toHaveAttribute('data-renderer', 'svg');
  await page.locator('[data-launch]').click();
  await page.locator('[data-range-toggle="segment"]').check();
  await expect(page.locator('[data-range-findings]')).toContainText(rangeCopy('en').dataStopped);
});
test('mobile, reduced motion and the compact Threat Hunt interaction', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const lab of RANGE_LABS) {
    await visit(page, lab.id, 'vi');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      lab.id,
    ).toBe(true);
  }
  await page.mouse.move(0, 0);
  await expect(page.locator('.hud__label')).toBeHidden();
  const compactWidth = await page
    .locator('[data-hud-toggle]')
    .evaluate((el) => el.getBoundingClientRect().width);
  expect(compactWidth).toBeLessThan(100);
  await page.locator('[data-hud-toggle]').hover();
  await expect(page.locator('.hud__label')).toBeVisible();
  await expect(page.locator('#hud-panel')).toBeHidden();
  await page.locator('[data-hud-toggle]').click();
  await expect(page.locator('#hud-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#hud-panel')).toBeHidden();
  await page.locator('[data-hud-toggle]').blur();
  await page.mouse.move(0, 0);
  await expect(page.locator('.hud__label')).toBeHidden();
});
test('capture all immersive desktop scenes and a mobile terminal', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const lab of RANGE_LABS) {
    await visit(page, lab.id);
    await page.locator('[data-range-scene]').scrollIntoViewIfNeeded();
    await page
      .locator('[data-range-scene]')
      .screenshot({ path: testInfo.outputPath(`${lab.id}.png`) });
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await visit(page, 'response-terminal', 'vi');
  await page.screenshot({ path: testInfo.outputPath('terminal-mobile.png'), fullPage: true });
});
