import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ROUNDS } from '../../src/lib/phishGame';

test('resources has the game and the glossary and nothing else', async ({ page }) => {
  await page.goto('/en/resources/');
  await expect(page.locator('[data-game]')).toBeAttached();
  await expect(page.locator('#glossary')).toBeAttached();
  await expect(page.locator('[data-feed]')).toHaveCount(0);
  await expect(page.locator('.jump a')).toHaveText(['Phish or Not?', 'Glossary']);
});
test('phish game: play all ten rounds and get a score', async ({ page }) => {
  await page.goto('/en/resources/');
  const game = page.locator('[data-game]');
  await game.scrollIntoViewIfNeeded();
  for (let n = 0; n < ROUNDS.length; n++) {
    await expect(game.locator('[data-progress]')).toHaveText(`Message ${n + 1} of 10`);
    const r = ROUNDS[n]!;
    // answer correctly for even rounds, wrongly for odd rounds -> 5 correct
    const guessPhish = n % 2 === 0 ? r.phish : !r.phish;
    await game
      .getByRole('button', { name: guessPhish ? 'Phish' : 'Not phish', exact: true })
      .click();
    await expect(game.locator('[data-feedback]')).toContainText(
      n % 2 === 0 ? 'Correct.' : 'Not quite.',
    );
    await expect(game.locator('[data-next]')).toBeFocused();
    await game.locator('[data-next]').click();
  }
  const end = game.locator('[data-end]');
  await expect(end).toBeVisible();
  await expect(end).toBeFocused();
  await expect(end.getByRole('heading')).toHaveText('You got 5 of 10.');
  await end.getByRole('button', { name: 'Play again' }).click();
  await expect(game.locator('[data-progress]')).toHaveText('Message 1 of 10');
});

test('glossary search narrows results and reports empty state', async ({ page }) => {
  await page.goto('/en/resources/');
  const g = page.locator('[data-gloss]');
  await expect(g.locator('.gloss__item:visible')).toHaveCount(16);
  await g.getByLabel('Search terms').fill('ransom');
  await expect(g.locator('.gloss__item:visible')).toHaveCount(1);
  await expect(g.locator('[data-status]')).toHaveText('1 terms');
  await g.getByLabel('Search terms').fill('qqqq');
  await expect(g.locator('[data-status]')).toContainText('No terms match "qqqq"');
  await g.getByLabel('Search terms').fill('');
  await expect(g.locator('.gloss__item:visible')).toHaveCount(16);
});

for (const lang of ['en', 'vi']) {
  test(`resources page passes axe in ${lang} (also mid-game)`, async ({ page }) => {
    await page.goto(`/${lang}/resources/`);
    await page.locator('[data-game] [data-guess="phish"]').click();
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  });
}
