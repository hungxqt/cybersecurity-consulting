import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const SPOTS: [string, string][] = [
  ['/en/', 'debug-flag'],
  ['/en/solutions/soc/', 'open-port'],
  ['/en/blog/', 'stale-dependency'],
  ['/en/resources/', 'default-creds'],
  ['/en/experience/', 'exposed-backup'],
];

for (const lang of ['en', 'vi']) {
  test(`hunt keeps counting after rejected storage writes and navigation (${lang})`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'ht-hunt-v1') throw new DOMException('Storage full', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    });
    await page.goto(`/${lang}/`);
    const toggle = page.locator('[data-hud-toggle]');
    const first = page.locator('[data-hunt-spot="debug-flag"]');
    await first.click();
    await expect(first).toHaveAttribute('data-found', '');
    await expect(toggle).toContainText('1/5');
    await first.click();
    await expect(toggle).toContainText('1/5');

    // Follow a real link so the in-memory fallback survives the client-side swap.
    await page.locator(`header a[href="/${lang}/blog/"]:visible`).click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/blog/$`));
    await expect(toggle).toContainText('1/5');
    await page.locator('[data-hunt-spot="stale-dependency"]').click();
    await expect(toggle).toContainText('2/5');
    await toggle.click();
    await page.locator('[data-hud-reset]').click();
    await expect(toggle).toContainText('0/5');
    await expect(page.locator('[data-hunt-spot="stale-dependency"]')).not.toHaveAttribute(
      'data-found',
    );
  });
}

test('finding all five hidden vulnerabilities unlocks the reward and persists', async ({
  page,
}) => {
  await page.goto('/en/');
  const toggle = page.locator('[data-hud-toggle]');
  await expect(toggle).toContainText('0/5');

  for (let n = 0; n < SPOTS.length; n++) {
    const [url, id] = SPOTS[n]!;
    if (n > 0) await page.goto(url);
    const spot = page.locator(`[data-hunt-spot="${id}"]`);
    await spot.scrollIntoViewIfNeeded();
    await spot.click();
    await expect(spot).toHaveAttribute('data-found', '');
    await expect(toggle).toContainText(`${n + 1}/5`);
    await expect(page.locator('[data-hud-live]')).toContainText(`${n + 1} of 5`);
    // clicking again changes nothing
    await spot.click();
    await expect(toggle).toContainText(`${n + 1}/5`);
  }

  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const reward = page.locator('[data-hud-reward]');
  await expect(reward).toBeVisible();
  await expect(reward.getByRole('link', { name: 'Claim the walkthrough' })).toHaveAttribute(
    'href',
    '/en/contact/?hunt=THREAT-HUNTER',
  );

  // Persistence across a full reload
  await page.reload();
  await expect(page.locator('[data-hud-toggle]')).toContainText('5/5');
  await expect(page.locator('[data-hud] [data-item][data-found]')).toHaveCount(5);

  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);

  await page.locator('[data-hud-toggle]').click();
  await page.locator('[data-hud-reset]').click();
  await expect(page.locator('[data-hud-toggle]')).toContainText('0/5');
});

test('hud panel opens with the keyboard and closes with Escape', async ({ page }) => {
  await page.goto('/en/about/');
  const toggle = page.locator('[data-hud-toggle]');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#hud-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
});

test('every page ends with next-step cards that lead somewhere else', async ({ page }) => {
  const pages = [
    '/en/',
    '/en/solutions/consulting/',
    '/en/solutions/audit/',
    '/vi/solutions/soc/',
    '/en/blog/',
    '/en/about/',
    '/en/contact/',
  ];
  for (const url of pages) {
    await page.goto(url);
    const links = page
      .getByRole('navigation', { name: url.startsWith('/vi/') ? 'Khám phá tiếp' : 'Where to next' })
      .getByRole('link');
    await expect(links).toHaveCount(2);
    const hrefs = await links.evaluateAll((els) =>
      els.map((e) => (e as HTMLAnchorElement).getAttribute('href')),
    );
    expect(hrefs).not.toContain(new URL(url, 'http://x').pathname);
  }
});

test('following next-step links walks the journey', async ({ page }) => {
  await page.goto('/en/solutions/consulting/');
  await page
    .getByRole('navigation', { name: 'Where to next' })
    .getByRole('link', { name: /Audit/ })
    .click();
  await expect(page).toHaveURL(/\/en\/solutions\/audit\/$/);
  await page
    .getByRole('navigation', { name: 'Where to next' })
    .getByRole('link', { name: /SOC/ })
    .click();
  await expect(page).toHaveURL(/\/en\/solutions\/soc\/$/);
});

test('review next-step link opens the contact form with consulting preselected', async ({
  page,
}) => {
  await page.goto('/en/resources/');
  await page
    .getByRole('navigation', { name: 'Where to next' })
    .getByRole('link', { name: /Request an attack-surface review/ })
    .click();
  await expect(page).toHaveURL(/\/en\/contact\/\?topic=consulting$/);
  await expect(page.getByLabel('What do you need?')).toHaveValue('consulting');
});
