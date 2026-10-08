import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const VENDOR = '/en/experience/journeys/vendor-account/';
const LAUNCH = '/en/experience/journeys/before-launch/';
const M = '\u2212';

async function open(page: Page, url: string) {
  await page.goto(url);
  await page.waitForSelector('[data-journey][data-live]');
}

const ids = (page: Page, attr: 'data-compromised' | 'data-contained') =>
  page.evaluate(
    (a) =>
      [...document.querySelectorAll<SVGElement>(`[data-node][${a}]`)]
        .map((n) => n.getAttribute('data-node')!)
        .sort(),
    attr,
  );

test.describe('beats, decision and links', () => {
  test('renders the act names and the playbook clock', async ({ page }) => {
    await open(page, VENDOR);
    await expect(page.locator('[data-beat] h3')).toHaveText([
      'Act 1 · Recon',
      'Act 1 · Recon',
      'Act 2 · Intrusion',
      'Act 2 · Intrusion',
      'Act 3 · Detection',
      'Act 3 · Detection',
      'Act 4 · Recovery',
      'Act 4 · Recovery',
    ]);
    await expect(page.locator('[data-beat] .beat__clock')).toHaveText([
      `T${M}7d`,
      `T${M}2d`,
      'T+00:00',
      'T+00:09',
      'T+00:17',
      'T+00:25',
      'T+04:00',
      'T+3d',
    ]);
    await expect(page.getByRole('navigation', { name: 'Playbook clock' })).toBeAttached();
    await expect(page.locator('[data-tick][aria-current="step"]')).toHaveCount(1);
    await expect(page.getByText(/^Playbook · /).first()).toBeVisible();
    await open(page, LAUNCH);
    await expect(page.locator('[data-beat] h3')).toHaveText([
      'Act 1 · Design',
      'Act 2 · Threat model',
      'Act 3 · Test',
      'Act 4 · Prove',
      'Act 5 · Launch',
    ]);
  });

  test('committing without a choice shows an error and keeps focus', async ({ page }) => {
    await open(page, VENDOR);
    const commit = page.getByRole('button', { name: 'Commit decision' });
    await commit.focus();
    await commit.click();
    const err = page.locator('#decision-err');
    await expect(err).toBeVisible();
    await expect(err).toHaveText('Choose an option first.');
    await expect(page.locator('#decision')).toHaveAttribute('aria-describedby', 'decision-err');
    await expect(page.locator('[data-outcome]:visible')).toHaveCount(0);
    await expect(commit).toBeFocused();
    // choosing clears it
    await page.getByRole('radio', { name: 'Disable the account and revoke sessions' }).check();
    await expect(err).toBeHidden();
  });

  test('choosing contain focuses the outcome; try another option returns to the fieldset', async ({
    page,
  }) => {
    await open(page, VENDOR);
    await page.getByRole('radio', { name: 'Disable the account and revoke sessions' }).check();
    await page.getByRole('button', { name: 'Commit decision' }).click();
    const outcome = page.locator('[data-outcome="contain"]');
    await expect(outcome).toBeVisible();
    await expect(outcome).toBeFocused();
    await expect(outcome).toContainText('Recommended choice');
    await expect(outcome).toContainText('Playbook: contain first, preserve evidence');
    await outcome.getByRole('button', { name: 'Try another option' }).click();
    await expect(outcome).toBeHidden();
    await expect(page.locator('#decision')).toBeFocused();
    await expect(page.locator('#decision input:checked')).toHaveCount(0);
  });

  test('the decision works from the keyboard and a non-recommended choice is explained', async ({
    page,
  }) => {
    await open(page, LAUNCH);
    await page.getByRole('radio', { name: 'Ship now, fix later' }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('radio', { name: 'Delay launch until it is fixed' })).toBeChecked();
    await page.getByRole('button', { name: 'Commit decision' }).focus();
    await page.keyboard.press('Enter');
    const outcome = page.locator('[data-outcome="slip"]');
    await expect(outcome).toBeFocused();
    await expect(outcome).toContainText('Not the recommended choice');
  });

  test('skip link jumps to the decision fieldset', async ({ page }) => {
    await open(page, VENDOR);
    await page.getByRole('link', { name: 'Skip to the decision' }).click();
    await expect(page).toHaveURL(/#decision$/);
    await expect(page.locator('#decision')).toBeInViewport();
  });

  test('clock ticks are links that jump to a beat', async ({ page }) => {
    await open(page, VENDOR);
    const tick = page.locator('[data-tick][href="#beat-4"]');
    await tick.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#beat-4$/);
    await expect(tick).toHaveAttribute('aria-current', 'step');
  });

  test('related links point at the solutions', async ({ page }) => {
    for (const url of [VENDOR, LAUNCH]) {
      await open(page, url);
      const hrefs = await page
        .locator('.beat__rel a')
        .evaluateAll((els) => els.map((e) => e.getAttribute('href')));
      expect(hrefs.length).toBeGreaterThan(0);
      for (const h of hrefs) expect(h).toMatch(/^\/en\/solutions\/(consulting|audit|soc)\/$/);
    }
    await open(page, VENDOR);
    await expect(page.getByRole('link', { name: 'Talk to an analyst' })).toHaveAttribute(
      'href',
      '/en/contact/',
    );
    await expect(page.getByRole('link', { name: 'Before launch' })).toHaveAttribute(
      'href',
      '/en/experience/journeys/before-launch/',
    );
  });
});

test.describe('motion', () => {
  test('requests the GSAP chunks lazily when motion is allowed', async ({ page }) => {
    const urls: string[] = [];
    page.on('request', (r) => urls.push(r.url()));
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, VENDOR);
    await page.mouse.wheel(0, 900);
    await expect.poll(() => urls.some((u) => /\/_astro\/gsap\./.test(u))).toBe(true);
    expect(urls.some((u) => /\/_astro\/ScrollTrigger\./.test(u))).toBe(true);
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('never requests GSAP and shows the whole sequence statically', async ({ page }) => {
      const urls: string[] = [];
      page.on('request', (r) => urls.push(r.url()));
      await page.setViewportSize({ width: 1280, height: 800 });
      await open(page, VENDOR);
      await page.mouse.wheel(0, 2000);
      await page.waitForTimeout(500);
      expect(urls.filter((u) => /gsap|ScrollTrigger/i.test(u))).toEqual([]);
      for (const n of [1, 3, 5, 8]) {
        const beat = page.locator(`#beat-${n}`);
        await expect(beat.locator('.track--attacker')).toBeVisible();
        await expect(beat.locator('.track--defender')).toBeVisible();
      }
      await page.locator('#beat-6').scrollIntoViewIfNeeded();
      await expect(page.locator('[data-token]')).toHaveAttribute('data-off', '');
    });

    test('keeps focus clear of the sticky header, clock and HUD (1280x800, 375x740)', async ({
      page,
    }) => {
      for (const [width, height] of [
        [1280, 800],
        [375, 740],
      ] as const) {
        await page.setViewportSize({ width, height });
        await open(page, VENDOR);
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        const bad: string[] = [];
        for (let i = 0; i < 140; i++) {
          await page.keyboard.press('Tab');
          const r = await page.evaluate(() => {
            const el = document.activeElement as HTMLElement | null;
            if (!el || el === document.body) return { done: true as const };
            const b = el.getBoundingClientRect();
            const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
            const ok = !!hit && (el.contains(hit) || hit.contains(el));
            return { done: false as const, ok, label: el.outerHTML.slice(0, 90) };
          });
          if (r.done) break;
          if (!r.ok) bad.push(`${width}: ${r.label}`);
        }
        expect(bad).toEqual([]);
      }
    });
  });
});

test.describe('mobile steps (375px)', () => {
  test.use({ viewport: { width: 375, height: 740 } });

  test('Next and Previous move between beats and manage focus', async ({ page }) => {
    await open(page, VENDOR);
    const prev = page.getByRole('button', { name: 'Previous beat' });
    const next = page.getByRole('button', { name: 'Next beat' });
    const count = page.locator('[data-count]');
    await expect(count).toHaveText('1 of 8');
    await expect(prev).toBeDisabled();
    await expect(next).toBeEnabled();
    await next.click();
    await expect(page).toHaveURL(/#beat-2$/);
    await expect(page.locator('#beat-2 h3')).toBeFocused();
    await expect(count).toHaveText('2 of 8');
    await expect(prev).toBeEnabled();
    await expect(page.locator('[data-strip]')).toHaveText(`Act 1 · T${M}2d`);
    for (let i = 0; i < 6; i++) await next.click();
    await expect(count).toHaveText('8 of 8');
    await expect(next).toBeDisabled();
    await expect(page.locator('#beat-8 h3')).toBeFocused();
    await prev.click();
    await expect(count).toHaveText('7 of 8');
    await expect(next).toBeEnabled();
  });

  test('the board and the desktop tick row are not shown', async ({ page }) => {
    await open(page, VENDOR);
    await expect(page.locator('.sb')).toBeHidden();
    await expect(page.locator('[data-tick]').first()).toBeHidden();
  });
});

test('scroll-padding-top is 128px on journey pages', async ({ page }) => {
  await open(page, VENDOR);
  expect(
    await page.evaluate(() => getComputedStyle(document.documentElement).scrollPaddingTop),
  ).toBe('128px');
  await page.goto('/en/');
  expect(
    await page.evaluate(() => getComputedStyle(document.documentElement).scrollPaddingTop),
  ).toBe('80px');
});

test.describe('situation board', () => {
  test('is visible at 1280 once live and hidden at 900 and 375', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, VENDOR);
    await expect(page.locator('.sb')).toBeVisible();
    await expect(page.locator('.sb__label')).toHaveText('Situation board');
    await expect(page.locator('.sb__legend dd')).toHaveCount(6);
    await page.setViewportSize({ width: 900, height: 800 });
    await expect(page.locator('.sb')).toBeHidden();
    await page.setViewportSize({ width: 375, height: 740 });
    await expect(page.locator('.sb')).toBeHidden();
  });

  test('is not shown before the script is live (no JS)', async ({ browser }) => {
    const ctx = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 1280, height: 800 },
    });
    const page = await ctx.newPage();
    await page.goto(VENDOR);
    await expect(page.locator('.sb')).toBeHidden();
    await expect(page.locator('#beat-8 .track--defender')).toBeAttached();
    await ctx.close();
  });

  test('vendor-account: token and rings follow the active beat', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, VENDOR);
    await expect(page.locator('[data-token]')).toHaveAttribute('data-at', 'phish');
    await page.evaluate(() => (location.hash = '#beat-3'));
    await expect(page.locator('[data-token]')).toHaveAttribute('data-at', 'vpn');
    await expect.poll(() => ids(page, 'data-compromised')).toEqual(['idp', 'vpn']);
    await expect.poll(() => ids(page, 'data-contained')).toEqual([]);
    await page.evaluate(() => (location.hash = '#beat-6'));
    await expect(page.locator('[data-token]')).toHaveAttribute('data-off', '');
    await expect(page.locator('[data-token]')).toBeHidden();
    await expect.poll(() => ids(page, 'data-contained')).toEqual(['idp', 'vpn']);
    await expect.poll(() => ids(page, 'data-compromised')).toEqual(['data']);
  });

  test('before-launch: hypothetical label and dashed rings', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, LAUNCH);
    await expect(page.locator('.sb__label')).toHaveText('What an attacker would try');
    await expect(page.locator('.sb__legend dd').nth(4)).toHaveText('Would be exposed');
    await page.evaluate(() => (location.hash = '#beat-2'));
    await expect.poll(() => ids(page, 'data-compromised')).toEqual(['data']);
    const dash = await page
      .locator('[data-node="data"] .sb__ring')
      .evaluate((el) => getComputedStyle(el).strokeDasharray);
    expect(dash).not.toBe('none');
    const tokenDash = await page
      .locator('[data-token] path')
      .evaluate((el) => getComputedStyle(el).strokeDasharray);
    expect(tokenDash).not.toBe('none');
  });
});

for (const lang of ['en', 'vi'] as const) {
  for (const id of ['vendor-account', 'before-launch']) {
    test(`/${lang}/experience/journeys/${id}/ passes axe`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/${lang}/experience/journeys/${id}/`);
      await page.waitForSelector('[data-journey][data-live]');
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
        .analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    });
  }
}

test('the experience index lists both journeys as reel rows', async ({ page }) => {
  await page.goto('/en/experience/');
  const reels = page.locator('#journeys .reel');
  await expect(reels).toHaveCount(2);
  await expect(reels.nth(0)).toContainText('The vendor account');
  await expect(reels.nth(0)).toContainText('8 beats · 1 decision');
  await expect(reels.nth(1)).toContainText('Before launch');
  await expect(reels.nth(1)).toContainText('5 beats · 1 decision');
  await expect(page.getByText('They describe no client and report no result.')).toBeVisible();
  await page.getByRole('link', { name: /Start the journey\s*:\s*Before launch/ }).click();
  await expect(page).toHaveURL(/\/en\/experience\/journeys\/before-launch\/$/);
});

test('the reel collapses to first, decision and last below 720px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/en/experience/');
  const shown = page.locator('[data-reel="vendor-account"] .reel__tick:visible .reel__clock');
  await expect(shown).toHaveText([`T${M}7d`, 'T+00:17 (Decision point)', 'T+3d']);
});

test('the home page has the breach band and does not load GSAP', async ({ page }) => {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  await page.goto('/en/');
  await page.waitForLoadState('networkidle');
  await expect(
    page.getByText('Follow a vendor-account breach from first scan to recovery.'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Start the journey/ })).toHaveAttribute(
    'href',
    '/en/experience/journeys/vendor-account/',
  );
  expect(urls.filter((u) => /gsap|ScrollTrigger/i.test(u))).toEqual([]);
});
