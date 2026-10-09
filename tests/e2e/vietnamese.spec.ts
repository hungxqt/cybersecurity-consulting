import { expect, test } from '@playwright/test';

test('language switch renders Vietnamese text and switches back on the same page', async ({
  page,
}) => {
  await page.goto('/en/solutions/audit/');
  await page.getByRole('link', { name: 'Switch to Tiếng Việt' }).click();
  await expect(page).toHaveURL(/\/vi\/solutions\/audit\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.locator('h1')).toContainText('Tuân thủ và kiểm toán.');
  await expect(page.locator('.primary-nav')).toContainText('Giải pháp');
  await expect(page.locator('.site-footer')).toContainText('Công ty');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /Chuẩn bị cho ISO 27001/,
  );
  await page.getByRole('link', { name: 'Chuyển sang English' }).click();
  await expect(page).toHaveURL(/\/en\/solutions\/audit\/$/);
  await expect(page.locator('h1')).toContainText('Compliance and audit.');
});

test('Vietnamese mobile navigation, forms and feedback use Vietnamese', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/vi/');
  await expect(page.locator('h1')).toContainText('Chúng tôi lập bản đồ trước họ.');
  await page.getByRole('button', { name: 'Mở trình đơn' }).click();
  await page
    .locator('#mobile-menu')
    .getByRole('link', { name: 'Trao đổi với chuyên viên', exact: true })
    .click();
  await expect(page).toHaveURL(/\/vi\/contact\/$/);
  await expect(page.getByLabel('Họ tên', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
  await expect(page.locator('[data-summary]')).toHaveText('Sửa 5 trường để gửi tin nhắn.');
  await expect(page.locator('#c-name-err')).toContainText('Nhập họ tên');
});

test('Vietnamese interactive resources retain their locale after client navigation', async ({
  page,
}) => {
  await page.goto('/vi/');
  await page.locator('.primary-nav').getByRole('link', { name: 'Tài nguyên', exact: true }).click();
  await expect(page).toHaveURL(/\/vi\/resources\/$/);
  const game = page.locator('[data-game]');
  await expect(game.locator('[data-progress]')).toHaveText('Thông điệp 1 trên 10');
  await game.getByRole('button', { name: 'Lừa đảo', exact: true }).click();
  await expect(game.locator('[data-feedback]')).toContainText('Chính xác.');
  await page.getByLabel('Tìm thuật ngữ', { exact: true }).fill('tong tien');
  await expect(page.locator('[data-gloss] [data-status]')).toHaveText('1 thuật ngữ');
});
