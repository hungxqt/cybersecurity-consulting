import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const axe = (page: import('@playwright/test').Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();

test('consulting quiz: answer all eight, see a radar chart with a text alternative', async ({
  page,
}) => {
  await page.goto('/en/solutions/consulting/');
  const quiz = page.locator('[data-quiz]');
  await quiz.getByRole('button', { name: 'Next question' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Choose an answer' })).toBeVisible();

  for (let n = 0; n < 8; n++) {
    await expect(quiz.locator('legend')).toHaveText(`Question ${n + 1} of 8`);
    await quiz.getByLabel(n % 2 ? 'Documented' : 'Measured and improved').check();
    await quiz.locator('[data-next]').click();
  }
  const result = quiz.locator('[data-result]');
  await expect(result).toBeVisible();
  await expect(result).toBeFocused();
  // answers: 3,2,3,2,3,2,3,2 -> 20/24 = 83 -> Managed
  await expect(result.getByRole('heading', { name: 'Your result: Managed' })).toBeVisible();
  const chart = result.getByRole('img');
  await expect(chart).toHaveAttribute('aria-label', /Govern 83, Protect 83, Detect 83, Respond 83/);
  await expect(result.locator('dl')).toContainText('Govern');
  const href = await result
    .getByRole('link', { name: /Discuss these results/ })
    .getAttribute('href');
  expect(href).toContain('/en/contact/?quiz=');
  expect((await axe(page)).violations.map((v) => v.id)).toEqual([]);

  await result.getByRole('button', { name: 'Retake the quiz' }).click();
  await expect(quiz.locator('legend')).toHaveText('Question 1 of 8');
});

test('quiz back button keeps earlier answers', async ({ page }) => {
  await page.goto('/en/solutions/consulting/');
  const quiz = page.locator('[data-quiz]');
  await quiz.getByLabel('Ad hoc').check();
  await quiz.locator('[data-next]').click();
  await quiz.locator('[data-back]').click();
  await expect(quiz.getByLabel('Ad hoc')).toBeChecked();
});

test('audit matrix filters by framework and updates the timeline', async ({ page }) => {
  await page.goto('/en/solutions/audit/');
  const m = page.locator('[data-matrix]');
  await expect(m.locator('[data-summary]')).toContainText('10 control areas');
  const total = async () => (await m.locator('[data-total]').innerText()).match(/\d+/)![0];
  const all = Number(await total());

  await m.getByLabel('SOC 2 Type II').uncheck();
  await m.getByLabel('PCI DSS').uncheck();
  await expect(m.locator('th[data-fw="soc2"]')).toBeHidden();
  await expect(m.locator('th[data-fw="iso27001"]')).toBeVisible();
  expect(Number(await total())).toBe(21);
  expect(all).toBeGreaterThan(21);

  await m.getByLabel('ISO/IEC 27001').uncheck();
  await expect(m.locator('[data-summary]')).toContainText('Select at least one framework');
  await expect(m.locator('tbody tr')).toHaveCount(0);

  await m.getByLabel('SOC 2 Type II').check();
  await expect(m.locator('tbody tr')).toHaveCount(10);
  await expect(m.locator('tbody tr').last().locator('td[data-fw="soc2"]')).toHaveText('Light');
  expect((await axe(page)).violations.map((v) => v.id)).toEqual([]);
});

test('soc dashboard shows live alerts, triage states and KPIs', async ({ page }) => {
  await page.goto('/en/solutions/soc/');
  const soc = page.locator('[data-soc]');
  await soc.scrollIntoViewIfNeeded();
  await expect(soc.locator('tbody tr').first()).toBeVisible();
  await expect(soc.locator('.chip[data-state="triaging"]').first()).toBeVisible({ timeout: 8000 });
  await expect(
    soc.locator('.chip[data-state="closed"], .chip[data-state="escalated"]').first(),
  ).toBeVisible({ timeout: 10_000 });
  const alerts = Number(await soc.locator('[data-kpi="alerts"]').innerText());
  expect(alerts).toBeGreaterThan(0);
  expect((await axe(page)).violations.map((v) => v.id)).toEqual([]);
});

test('soc pause button toggles aria-pressed and stops arrivals', async ({ page }) => {
  await page.goto('/en/solutions/soc/');
  const soc = page.locator('[data-soc]');
  await soc.scrollIntoViewIfNeeded();
  const pause = soc.locator('[data-soc-pause]');
  await expect(pause).toHaveAttribute('aria-pressed', 'false');
  await expect(soc.locator('[data-kpi="alerts"]')).not.toHaveText('8', { timeout: 8000 });
  await pause.click();
  await expect(pause).toHaveAttribute('aria-pressed', 'true');
  await expect(pause).toHaveText('Resume simulation');
  const frozen = await soc.locator('tbody tr').first().innerText();
  const alerts = await soc.locator('[data-kpi="alerts"]').innerText();
  await page.waitForTimeout(3500);
  expect(await soc.locator('tbody tr').first().innerText()).toBe(frozen);
  expect(await soc.locator('[data-kpi="alerts"]').innerText()).toBe(alerts);
  await pause.click();
  await expect(pause).toHaveAttribute('aria-pressed', 'false');
  await expect(soc.locator('tbody tr').first()).not.toHaveText(frozen, { timeout: 8000 });
});

test('soc simulation waits until the panel is in view', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/en/solutions/soc/');
  const first = page.locator('[data-soc] tbody tr').first();
  const text = await first.innerText();
  await page.waitForTimeout(2000);
  expect(await first.innerText()).toBe(text);
  await page.locator('[data-soc]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-soc] tbody tr').first()).not.toHaveText(text, {
    timeout: 8000,
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('soc dashboard stays static with 8 settled alerts', async ({ page }) => {
    await page.goto('/en/solutions/soc/');
    await page.waitForTimeout(2500);
    await expect(page.locator('[data-queue] tr')).toHaveCount(8);
    await expect(page.locator('.chip[data-state="new"], .chip[data-state="triaging"]')).toHaveCount(
      0,
    );
  });
});

for (const lang of ['en', 'vi']) {
  test(`solutions index in ${lang} has the atlas, method and three ledger rows`, async ({
    page,
  }) => {
    await page.goto(`/${lang}/solutions/`);
    await expect(page.locator('[data-atlas]')).toBeVisible();
    await expect(page.locator('#method ol.method li')).toHaveCount(5);
    await expect(page.locator('.ledger--rows > li')).toHaveCount(3);
  });
}
