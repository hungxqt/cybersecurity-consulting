import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { LABS, labCopy } from '../../src/lib/labs';

test.beforeEach(async ({ page, baseURL }) => {
  const block = readFileSync('public/_headers', 'utf8').split(/\n\s*\n/)[0]!;
  const headers: Record<string, string> = {};
  for (const line of block.split('\n').slice(1)) {
    const i = line.indexOf(':');
    if (i > 0) headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  await page.route(`${baseURL}/**`, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), ...headers } });
  });
  await page.addInitScript(() => {
    const violations: string[] = [];
    Object.assign(window, { labCsp: violations });
    document.addEventListener('securitypolicyviolation', (e) =>
      violations.push(`${e.violatedDirective} ${e.blockedURI}`),
    );
  });
});

for (const lang of ['en', 'vi'] as const) {
  const c = labCopy(lang);
  test(`${lang}: index links navigate to six accessible labs with production CSP`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`/${lang}/experience/`);
    await expect(page.locator('#labs a')).toHaveCount(14);
    for (const lab of LABS) {
      await page.locator(`a[href='/${lang}/experience/labs/${lab.id}/']`).first().click();
      await expect(page.locator('[data-lab]')).toHaveAttribute('data-ready', 'true');
      await expect(
        page.locator('.lab-nodes, .lab-table, [data-nodes], [data-buckets]'),
      ).toHaveCount(0);
      const axe = await new AxeBuilder({ page })
        .include('[data-lab]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(axe.violations, lab.id).toEqual([]);
      expect(await page.evaluate(() => (window as unknown as { labCsp: string[] }).labCsp)).toEqual(
        [],
      );
    }
    expect(errors).toEqual([]);
  });
  test(`${lang}: defenses and architecture change the modeled paths`, async ({ page }) => {
    await page.goto(`/${lang}/experience/labs/attack-defense/`);
    await page.locator('[data-defense="mfa"]').check();
    await expect(page.locator('[data-result]')).toContainText(c.passwordStop);
    await page.locator('[data-route]').selectOption('malware');
    await expect(page.locator('[data-result]')).toContainText(c.malwareOpen);
    await page.locator('[data-defense="edr"]').check();
    await expect(page.locator('[data-result]')).toContainText(c.malwareStop);
    await page.locator('[data-reset]').click();
    await expect(page.locator('[data-result]')).toContainText(c.passwordOpen);
    await page.goto(`/${lang}/experience/labs/architecture-builder/`);
    await page.locator('[data-boundary="identityGate"]').check();
    await expect(page.locator('[data-result]')).toContainText(c.missingIdentity);
    await page.locator('[data-component="identity"]').check();
    await page.locator('[data-boundary="privateData"]').check();
    await expect(page.locator('[data-result]')).toContainText(c.architectureGood);
    await page.locator('[data-component="database"]').uncheck();
    await page.locator('[data-component="backup"]').check();
    await expect(page.locator('[data-result]')).toContainText(c.backupDependency);
  });
  test(`${lang}: SOC evidence and decisions remain specific to each alert`, async ({ page }) => {
    await page.goto(`/${lang}/experience/labs/soc-console/`);
    await page.locator('[data-response="monitor"]').click();
    await expect(page.locator('[data-result]')).toContainText(c.responseMonitor);
    await page.locator('[data-response="revoke"]').click();
    await expect(page.locator('[data-result]')).toContainText(c.responseRight);
    await page.locator('[data-alert="1"]').click();
    await expect(page.locator('[data-evidence]')).toContainText('WS-17');
    await expect(page.locator('[data-response="revoke"]')).toHaveAttribute('aria-pressed', 'false');
    await page.locator('[data-response="isolate"]').click();
    await expect(page.locator('[data-result]')).toContainText(c.responseRight);
    await page.locator('[data-alert="0"]').click();
    await expect(page.locator('[data-response="revoke"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-alert="2"]').click();
    await page.locator('[data-response="blockTransfer"]').click();
    await expect(page.locator('[data-result]')).toContainText(c.responseRight);
    await page.locator('[data-reset]').click();
    await expect(page.locator('[data-response][aria-pressed="true"]')).toHaveCount(0);
  });
  test(`${lang}: timeline supports keyboard scrubbing, playback and reset`, async ({ page }) => {
    await page.goto(`/${lang}/experience/labs/incident-timeline/`);
    await page.locator('[data-position]').focus();
    await page.keyboard.press('End');
    await expect(page.locator('[data-stage-title]')).toHaveText(c.stages.split('|')[4]!);
    await expect(page.locator('[data-next]')).toBeDisabled();
    await page.locator('[data-reset]').click();
    await page.locator('[data-play]').click();
    await expect(page.locator('[data-position]')).toHaveValue('1', { timeout: 5000 });
    await page.locator('[data-play]').click();
    await expect(page.locator('[data-lab]')).toHaveAttribute('data-playing', 'false');
    await page.locator('[data-stage="3"]').click();
    await expect(page.locator('.lab-graph svg desc')).toContainText(c.contained);
  });
  test(`${lang}: traffic threshold and packet controls alter the outcome`, async ({ page }) => {
    await page.goto(`/${lang}/experience/labs/traffic-anomalies/`);
    await expect(page.locator('[data-result]')).toContainText(`${c.crossings}: 1 / 24`);
    await page.locator('[data-pattern]').selectOption('beacon');
    await expect(page.locator('[data-result]')).toContainText(`${c.crossings}: 0 / 24`);
    await page.locator('[data-traffic="threshold"]').focus();
    await page.keyboard.press('Home');
    await expect(page.locator('[data-result]')).toContainText(`${c.crossings}: 24 / 24`);
    await expect(page.locator('.lab-chart svg')).toHaveAttribute('role', 'img');
    await expect(page.locator('.lab-chart svg desc')).toContainText(`${c.minute} 23:`);
    await page.goto(`/${lang}/experience/labs/packet-journey/`);
    await page.locator('[data-request]').selectOption('injection');
    await page.locator('[data-next]').click();
    await page.locator('[data-next]').click();
    await expect(page.locator('[data-result]')).toContainText(c.packetWafStop);
    await expect(page.locator('[data-next]')).toBeDisabled();
    await page.locator('[data-packet-control="waf"]').uncheck();
    for (let i = 0; i < 3; i++) await page.locator('[data-next]').click();
    await expect(page.locator('[data-result]')).toContainText(c.packetPrivilegeStop);
    await page.locator('[data-packet-control="leastPrivilege"]').uncheck();
    for (let i = 0; i < 3; i++) await page.locator('[data-next]').click();
    await expect(page.locator('[data-result]')).toContainText(c.packetWrite);
    await page.locator('[data-request]').selectOption('unauthorized');
    await page.locator('[data-next]').click();
    await expect(page.locator('[data-result]')).toContainText(c.packetSourceStop);
    await page.locator('[data-reset]').click();
    await expect(page.locator('[data-result]')).toContainText(c.packetDns);
  });
}
test('mobile labs fit the viewport and preserve reduced-motion behavior', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const lab of LABS) {
    await page.goto(`/vi/experience/labs/${lab.id}/`);
    await expect(page.locator('[data-lab]')).toHaveAttribute('data-ready', 'true');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.locator('[data-play]').click();
  const animation = await page
    .locator('.graph-edge.active')
    .first()
    .evaluate((el) => getComputedStyle(el).animationName);
  expect(animation).toBe('none');
});

test('capture desktop and mobile lab layouts', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/en/experience/#labs');
  await page.locator('#labs').screenshot({ path: testInfo.outputPath('lab-index.png') });
  for (const lab of LABS) {
    await page.goto(`/en/experience/labs/${lab.id}/`);
    await expect(page.locator('[data-lab]')).toHaveAttribute('data-ready', 'true');
    await page.locator('.lab-grid').screenshot({ path: testInfo.outputPath(`${lab.id}.png`) });
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/vi/experience/labs/packet-journey/');
  await page.screenshot({ path: testInfo.outputPath('packet-mobile.png'), fullPage: true });
});
