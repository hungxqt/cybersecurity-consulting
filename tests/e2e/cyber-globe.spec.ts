import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('globe filters routes, focuses destinations and pauses', async ({ page }) => {
  await page.goto('/en/cyber-map/');
  const globe = page.locator('[data-cyber-globe]');
  await globe.scrollIntoViewIfNeeded();
  await expect(globe.getByText('Telemetry offline', { exact: true })).toBeVisible();
  await expect(globe.locator('[data-route-item]:visible')).toHaveCount(18);
  await globe.getByLabel('Attack / incident type').selectOption('ddos');
  await expect(globe.locator('[data-route-item]:visible')).toHaveCount(3);
  await globe.locator('[data-route="0"]').click();
  await expect(globe.locator('[data-selection]')).toContainText('Ho Chi Minh City');
  await expect(globe.locator('[data-route="0"]')).toHaveAttribute('aria-pressed', 'true');
  await globe.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(globe.getByRole('button', { name: 'Resume', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await globe.locator('canvas').focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('+');
  await globe.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(globe.locator('[data-route="0"]')).toHaveAttribute('aria-pressed', 'false');
  const accessibility = await new AxeBuilder({ page }).include('[data-cyber-globe]').analyze();
  expect(accessibility.violations).toEqual([]);
  await globe.screenshot({ path: 'test-results/cyber-globe-desktop.png' });
});

test('mobile reduced-motion globe starts paused and fits viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/vi/cyber-map/');
  const globe = page.locator('[data-cyber-globe]');
  await globe.scrollIntoViewIfNeeded();
  await expect(globe.getByText('Chưa kết nối dữ liệu', { exact: true })).toBeVisible();
  await expect(globe.locator('[data-pause]')).toHaveText('Tiếp tục');
  await expect(globe.locator('[data-pause]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await globe.locator('#cyber-filter').selectOption('malware');
  await expect(globe.locator('[data-route-item]:visible')).toHaveCount(3);
  await globe.screenshot({ path: 'test-results/cyber-globe-mobile.png' });
});

test('incident filters, response details, empty states and page navigation', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('[data-cyber-globe]')).toHaveCount(0);
  await page
    .getByRole('navigation', { name: 'Primary', exact: true })
    .getByRole('link', { name: 'Cyber map', exact: true })
    .click();
  await expect(page).toHaveURL(/\/en\/cyber-map\/$/);
  const globe = page.locator('[data-cyber-globe]');
  await globe.getByLabel('Category', { exact: true }).selectOption('incident');
  await expect(globe.locator('[data-route-item]:visible')).toHaveCount(3);
  await globe.getByLabel('Review priority', { exact: true }).selectOption('medium');
  await expect(globe.locator('[data-route-item]:visible')).toHaveCount(1);
  await globe.locator('[data-route-item]:visible button').click();
  await expect(globe.locator('[data-detail-title]')).toHaveText('Identity anomaly');
  await expect(globe.locator('[data-detail-action]')).toContainText('Correlate');
  const accessibility = await new AxeBuilder({ page }).include('[data-cyber-globe]').analyze();
  expect(accessibility.violations).toEqual([]);
  await globe.getByLabel('Review priority', { exact: true }).selectOption('critical');
  await expect(globe.locator('[data-route-item]:visible')).toHaveCount(0);
  await expect(globe.locator('[data-empty]')).toBeVisible();
  await expect(globe.locator('[data-detail]')).toBeHidden();
  await page.goto('/en/');
  await page.goto('/en/cyber-map/');
  await expect(page.locator('[data-route-item]:visible')).toHaveCount(18);
});
