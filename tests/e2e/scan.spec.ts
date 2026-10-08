import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('scan flow: example.com produces a report and a pre-filled contact link', async ({ page }) => {
  await page.goto('/en/experience/');
  await page.locator('#scan').scrollIntoViewIfNeeded();
  await page.getByLabel('Domain').fill('example.com');
  await page.getByRole('button', { name: 'Run simulated scan' }).click();

  const report = page.locator('[data-report]');
  await expect(report).toBeVisible({ timeout: 10_000 });
  await expect(report.getByRole('heading', { name: 'Report for example.com' })).toBeVisible();
  await expect(report).toBeFocused();
  await expect(page.locator('[data-status]')).toContainText('Scan complete');
  await expect(report).toContainText('Simulated result for demonstration only.');

  const href = await report
    .getByRole('link', { name: 'Get these fixed with an analyst' })
    .getAttribute('href');
  expect(href).toContain('/en/contact/?domain=example.com&scan=');
  expect(decodeURIComponent(href!)).toContain('Simulated scan of example.com');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
});

test('same domain gives the same report twice', async ({ page }) => {
  await page.goto('/en/experience/');
  const read = async () => {
    await page.getByLabel('Domain').fill('acme.io');
    await page.getByRole('button', { name: 'Run simulated scan' }).click();
    await expect(page.locator('[data-report]')).toBeVisible({ timeout: 10_000 });
    return page.locator('[data-report] dl').innerText();
  };
  const a = await read();
  await page.locator('[data-report]').getByRole('button', { name: 'Scan another domain' }).click();
  const b = await read();
  expect(a).toBe(b);
});

test('invalid input shows an accessible error and runs nothing', async ({ page }) => {
  await page.goto('/en/experience/');
  const input = page.getByLabel('Domain');
  for (const [value, message] of [
    ['', /Enter a domain/],
    ['not a domain', /does not look like a domain/],
    ['10.0.0.1', /not an IP address/],
  ] as const) {
    await input.fill(value);
    await page.getByRole('button', { name: 'Run simulated scan' }).click();
    await expect(page.getByRole('alert').filter({ hasText: message })).toBeVisible();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
  }
  await expect(page.locator('[data-term]')).toBeHidden();
});

test('the scan makes no network requests and discloses that it is a simulation', async ({
  page,
}) => {
  await page.goto('/en/experience/');
  await expect(page.getByText(/Simulation: nothing is sent anywhere/)).toBeVisible();
  await page.waitForLoadState('networkidle');
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.getByLabel('Domain').fill('example.com');
  await page.getByRole('button', { name: 'Run simulated scan' }).click();
  await expect(page.locator('[data-report]')).toBeVisible({ timeout: 10_000 });
  expect(requests).toEqual([]);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('finishes immediately', async ({ page }) => {
    await page.goto('/en/experience/');
    await page.getByLabel('Domain').fill('example.com');
    await page.getByRole('button', { name: 'Run simulated scan' }).click();
    await expect(page.locator('[data-report]')).toBeVisible({ timeout: 2000 });
  });
});
