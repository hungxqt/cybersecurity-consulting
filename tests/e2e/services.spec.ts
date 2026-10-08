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

test('soc page explains how an alert is handled, with no figures', async ({ page }) => {
  await page.goto('/en/solutions/soc/');
  await expect(page.getByRole('heading', { name: 'How an alert is handled' })).toBeVisible();
  const stages = page.locator('.flow__stage');
  await expect(stages).toHaveCount(4);
  await expect(stages.locator('.flow__name')).toHaveText(['Detect', 'Triage', 'Contain', 'Report']);
  const text = await page.locator('.flow').innerText();
  expect(text).not.toMatch(/\d+\s*(ms|min|%)|MTTD|MTTR/i);
  await expect(page.getByRole('link', { name: /Put analysts on your alerts/ })).toHaveAttribute(
    'href',
    '/en/contact/?topic=soc',
  );
  await expect(page.locator('[data-hunt-spot="open-port"]')).toBeAttached();
  expect((await axe(page)).violations.map((v) => v.id)).toEqual([]);
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
