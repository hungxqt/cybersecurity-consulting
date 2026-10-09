import { expect, test, type Page } from '@playwright/test';

/**
 * Smart prefetch (src/scripts/prefetch.ts, rules in src/lib/prefetchPolicy.ts).
 * The built-in Astro prefetch is disabled, so every page request below comes from our own module
 * or from the router's default loader.
 */

const testOrigin = () => new URL(test.info().project.use.baseURL ?? 'http://localhost:4321').origin;

interface Logged {
  path: string;
  type: string;
  t: number;
}

/** Record every same-origin request of a page. */
function track(page: Page) {
  const log: Logged[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.origin === testOrigin())
      log.push({ path: u.pathname, type: r.resourceType(), t: Date.now() });
  });
  return {
    log,
    /** Every request (any type) that targeted exactly this path. */
    to: (path: string) => log.filter((e) => e.path === path),
    /** Page-level HTML fetches issued from script (prefetch or the router's loader). */
    pageFetches: () => log.filter((e) => e.type === 'fetch' && /^\/(en|vi)\//.test(e.path)),
    pageFetchPaths: () =>
      log.filter((e) => e.type === 'fetch' && /^\/(en|vi)\//.test(e.path)).map((e) => e.path),
  };
}

function waitForPath(page: Page, path: string) {
  return page.waitForRequest((r) => new URL(r.url()).pathname === path, { timeout: 5_000 });
}

/** Delay the response of matching requests so that "in flight" is observable. */
async function delay(page: Page, pattern: RegExp | string, ms: number) {
  await page.route(pattern, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    try {
      await route.continue();
    } catch {
      // The page was closed while the request was held back.
    }
  });
}

interface Connection {
  saveData: boolean;
  effectiveType: string;
}

async function stubConnection(page: Page, connection: Connection) {
  await page.addInitScript((c) => {
    Object.defineProperty(navigator, 'connection', {
      value: { ...c, addEventListener() {}, removeEventListener() {} },
      configurable: true,
    });
  }, connection);
}

async function stubHidden(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
    Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
  });
}

const headerLink = (page: Page, path: string) =>
  page.locator(`.primary-nav a.nav-link[href="${path}"]`);

/** Fire an event on the first element matching `selector` (one synchronous task, no real pointer). */
async function fire(
  page: Page,
  selector: string,
  events: { type: string; pointerType?: string }[],
) {
  await page.evaluate(
    ({ selector: sel, events: list }) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error(`missing ${sel}`);
      for (const e of list) {
        el.dispatchEvent(
          new PointerEvent(e.type, { bubbles: true, pointerType: e.pointerType ?? 'mouse' }),
        );
      }
    },
    { selector, events },
  );
}

test.describe('intent prefetch (hover, focus, touch)', () => {
  test('hover then click requests the page HTML exactly once', async ({ page }) => {
    const t = track(page);
    await page.goto('/en/');
    const link = page.getByRole('link', { name: 'Explore solutions' });
    const requested = waitForPath(page, '/en/solutions/');
    await link.hover();
    await requested;
    await page.waitForTimeout(150);
    await link.click();
    await expect(page).toHaveURL(/\/en\/solutions\/$/);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'atlas');
    await page.waitForTimeout(300);
    expect(t.to('/en/solutions/')).toHaveLength(1);
    // Astro's built-in prefetch is off: no <link rel=prefetch> for a page URL.
    const prefetchLinks = await page.evaluate(() =>
      [...document.head.querySelectorAll<HTMLLinkElement>('link[rel~="prefetch"]')].map(
        (l) => new URL(l.href).pathname,
      ),
    );
    expect(prefetchLinks.filter((p) => /^\/(en|vi)\//.test(p))).toEqual([]);
    expect(await page.locator('html').getAttribute('data-astro-prefetch')).toBeNull();
  });

  test('a click while the prefetch is still in flight reuses it', async ({ page }) => {
    const t = track(page);
    await delay(page, '**/en/solutions/', 500);
    await page.goto('/en/');
    const link = page.getByRole('link', { name: 'Explore solutions' });
    await link.hover();
    await page.waitForTimeout(120);
    await link.click();
    await expect(page).toHaveURL(/\/en\/solutions\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForTimeout(300);
    expect(t.to('/en/solutions/')).toHaveLength(1);
  });

  test('leaving the link before the intent delay cancels the prefetch', async ({ page }) => {
    const t = track(page);
    await page.goto('/en/');
    // Same task: the 65 ms timer cannot have fired between the two events.
    await page.evaluate(() => {
      const a = document.querySelector('.primary-nav a.nav-link[href="/en/blog/"]')!;
      a.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
      a.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, pointerType: 'mouse' }));
    });
    await page.waitForTimeout(500);
    expect(t.to('/en/blog/')).toHaveLength(0);
  });

  test('keyboard focus prefetches the focused link', async ({ page }) => {
    const t = track(page);
    await page.goto('/en/');
    const requested = waitForPath(page, '/en/experience/');
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const href = await page.evaluate(() => document.activeElement?.getAttribute('href'));
      if (href === '/en/experience/') break;
    }
    await requested;
    expect(t.to('/en/experience/')).toHaveLength(1);
  });

  test('moving focus away before the intent delay cancels the prefetch', async ({ page }) => {
    const t = track(page);
    await page.goto('/en/');
    await page.keyboard.press('Tab'); // skip link, focus-visible
    await page.evaluate(() => {
      const a = document.querySelector<HTMLElement>('.primary-nav a.nav-link[href="/en/blog/"]')!;
      a.focus();
      a.blur();
    });
    await page.waitForTimeout(500);
    expect(t.to('/en/blog/')).toHaveLength(0);
  });
});

test.describe('touch', () => {
  test.use({ hasTouch: true });

  test('touch pointerdown prefetches immediately, a touch hover alone does not', async ({
    page,
  }) => {
    const t = track(page);
    await page.goto('/en/');
    const sel = '.primary-nav a.nav-link[href="/en/blog/"]';
    await fire(page, sel, [{ type: 'pointerover', pointerType: 'touch' }]);
    await page.waitForTimeout(400);
    expect(t.to('/en/blog/')).toHaveLength(0);
    const requested = waitForPath(page, '/en/blog/');
    await fire(page, sel, [{ type: 'pointerdown', pointerType: 'touch' }]);
    await requested;
    expect(t.to('/en/blog/')).toHaveLength(1);
  });

  test('tapping a link navigates with a single request', async ({ page }) => {
    const t = track(page);
    await page.goto('/en/');
    await page.getByRole('link', { name: 'Explore solutions' }).tap();
    await expect(page).toHaveURL(/\/en\/solutions\/$/);
    await page.waitForTimeout(300);
    expect(t.to('/en/solutions/')).toHaveLength(1);
  });
});

test.describe('fallback and eligibility', () => {
  test('a failed prefetch falls back to the normal navigation', async ({ page }) => {
    const t = track(page);
    let calls = 0;
    await page.route('**/en/solutions/', (route) =>
      calls++ === 0 ? route.abort() : route.continue(),
    );
    await page.goto('/en/');
    const link = page.getByRole('link', { name: 'Explore solutions' });
    const failed = page.waitForEvent(
      'requestfailed',
      (r) => new URL(r.url()).pathname === '/en/solutions/',
    );
    await link.hover();
    await failed;
    await page.waitForTimeout(100);
    await link.click();
    await expect(page).toHaveURL(/\/en\/solutions\/$/);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'atlas');
    // One failed prefetch plus the router's own request: documented, not a duplicate success.
    expect(t.to('/en/solutions/')).toHaveLength(2);
  });

  test('ineligible links are never requested', async ({ page }) => {
    await stubConnection(page, { saveData: false, effectiveType: '3g' }); // keeps idle prefetch off
    const t = track(page);
    await page.goto('/en/');
    await page.evaluate(() => {
      const box = document.createElement('div');
      const add = (id: string, href: string, attrs: Record<string, string> = {}) => {
        const a = document.createElement('a');
        a.id = id;
        a.href = href;
        a.textContent = id;
        for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
        box.append(a);
      };
      add('x-file', '/.well-known/security.txt');
      add('x-sitemap', '/sitemap-0.xml');
      add('x-legacy', '/en/services/soc/');
      add('x-external', 'https://example.com/en/about/');
      add('x-optout', '/en/careers/', { 'data-no-prefetch': '' });
      add('x-blank', '/en/careers/', { target: '_blank' });
      add('x-download', '/en/careers/', { download: '' });
      add('x-reload', '/en/careers/', { 'data-astro-reload': '' });
      add('x-hash', '#main');
      document.body.append(box);
    });
    const ids = [
      'x-file',
      'x-sitemap',
      'x-legacy',
      'x-external',
      'x-optout',
      'x-blank',
      'x-download',
      'x-reload',
      'x-hash',
    ];
    for (const id of ids) {
      await fire(page, `#${id}`, [{ type: 'pointerover' }, { type: 'pointerdown' }]);
    }
    // Real elements: language switch (data-astro-reload), skip link, mailto.
    await page.locator('a[data-astro-reload]').locator('visible=true').first().hover();
    await page.keyboard.press('Tab'); // skip link (#main)
    await page.locator('footer a[href^="mailto:"]').hover();
    await page.waitForTimeout(600);
    expect(t.pageFetchPaths()).toEqual([]);
    for (const path of [
      '/.well-known/security.txt',
      '/sitemap-0.xml',
      '/en/services/soc/',
      '/en/careers/',
    ]) {
      expect(t.to(path), path).toHaveLength(0);
    }
  });
});

test.describe('network-aware', () => {
  for (const [name, connection] of [
    ['save-data', { saveData: true, effectiveType: '4g' }],
    ['2g', { saveData: false, effectiveType: '2g' }],
  ] as const) {
    test(`${name}: neither hover nor idle prefetch`, async ({ page }) => {
      test.setTimeout(30_000);
      await stubConnection(page, connection);
      const t = track(page);
      await page.goto('/en/');
      await headerLink(page, '/en/blog/').hover();
      await page.waitForTimeout(6_500);
      expect(t.pageFetchPaths()).toEqual([]);
    });
  }

  test('3g: hover prefetches, idle does not', async ({ page }) => {
    test.setTimeout(30_000);
    await stubConnection(page, { saveData: false, effectiveType: '3g' });
    const t = track(page);
    await page.goto('/en/');
    const requested = waitForPath(page, '/en/blog/');
    await headerLink(page, '/en/blog/').hover();
    await requested;
    await page.waitForTimeout(6_500);
    expect(t.pageFetchPaths()).toEqual(['/en/blog/']);
  });

  test('4g: hover and idle both prefetch', async ({ page }) => {
    test.setTimeout(30_000);
    await stubConnection(page, { saveData: false, effectiveType: '4g' });
    const t = track(page);
    await page.goto('/en/');
    const requested = waitForPath(page, '/en/blog/');
    await headerLink(page, '/en/blog/').hover();
    await requested;
    await expect
      .poll(() => t.pageFetchPaths(), { timeout: 12_000 })
      .toEqual(expect.arrayContaining(['/en/experience/', '/en/solutions/', '/en/contact/']));
  });
});

test.describe('idle prefetch', () => {
  test('requests a few likely pages once each, never before ~2.5 s, and again for the next page', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const t = track(page);
    await page.goto('/en/solutions/');
    const loadedAt = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return performance.timeOrigin + nav.loadEventEnd;
    });
    await expect
      .poll(() => t.pageFetchPaths().sort(), { timeout: 12_000 })
      .toEqual(['/en/contact/', '/en/experience/']);
    for (const e of t.pageFetches()) expect(e.t - loadedAt, e.path).toBeGreaterThanOrEqual(2_500);
    await page.waitForTimeout(1_000);
    const paths = t.pageFetchPaths();
    expect(paths.length).toBeLessThanOrEqual(3);
    expect(new Set(paths).size).toBe(paths.length);

    // Navigating (served from the cache) schedules idle work for the new page, never repeating old pages.
    await headerLink(page, '/en/experience/').click();
    await expect(page).toHaveURL(/\/en\/experience\/$/);
    await expect
      .poll(() => t.to('/en/solutions/').filter((e) => e.type === 'fetch').length, {
        timeout: 12_000,
      })
      .toBe(1);
    await page.waitForTimeout(1_000);
    expect(t.to('/en/contact/')).toHaveLength(1);
    expect(t.to('/en/experience/')).toHaveLength(1);
    expect(t.to('/en/solutions/').filter((e) => e.type === 'fetch')).toHaveLength(1);
  });

  test('a hidden tab never prefetches', async ({ page }) => {
    test.setTimeout(30_000);
    await stubHidden(page);
    const t = track(page);
    await page.goto('/en/solutions/');
    await page.waitForTimeout(6_500);
    expect(t.pageFetchPaths()).toEqual([]);
  });
});

test('at most two page requests are in flight', async ({ page }) => {
  await stubConnection(page, { saveData: false, effectiveType: '3g' }); // no idle work in this test
  await delay(page, /\/en\/(blog|experience|resources|about)\/$/, 400);
  let inFlight = 0;
  let peak = 0;
  const isPage = (url: string) => {
    const u = new URL(url);
    return (
      u.origin === testOrigin() && /^\/en\/(blog|experience|resources|about)\/$/.test(u.pathname)
    );
  };
  const seen = new Set<string>();
  page.on('request', (r) => {
    if (r.resourceType() !== 'fetch' || !isPage(r.url())) return;
    seen.add(new URL(r.url()).pathname);
    inFlight++;
    peak = Math.max(peak, inFlight);
  });
  const done = (r: { url(): string; resourceType(): string }) => {
    if (r.resourceType() === 'fetch' && isPage(r.url())) inFlight--;
  };
  page.on('requestfinished', done);
  page.on('requestfailed', done);

  await page.goto('/en/');
  await page.evaluate(() => {
    for (const href of ['/en/blog/', '/en/experience/', '/en/resources/', '/en/about/']) {
      document
        .querySelector(`a[href="${href}"]`)!
        .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));
    }
  });
  await expect.poll(() => seen.size, { timeout: 8_000 }).toBe(4);
  await page.waitForTimeout(300);
  expect(peak).toBeLessThanOrEqual(2);
  expect(peak).toBeGreaterThan(0);
});

test.describe('page transition', () => {
  async function recordTransition(page: Page) {
    await page.evaluate(() => {
      const w = window as unknown as { __vt: number[] };
      w.__vt = [];
      const tick = () => {
        for (const a of document.getAnimations()) {
          const effect = a.effect as KeyframeEffect | null;
          if (!effect || !(effect.pseudoElement ?? '').startsWith('::view-transition')) continue;
          const d = effect.getTiming().duration;
          if (typeof d === 'number') w.__vt.push(d);
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
  const durations = (page: Page) =>
    page.evaluate(() => (window as unknown as { __vt: number[] }).__vt);

  test('the cross-fade lasts at most 150 ms', async ({ page }) => {
    await page.goto('/en/');
    await recordTransition(page);
    const link = page.getByRole('link', { name: 'Explore solutions' });
    await link.hover();
    await page.waitForTimeout(200);
    await link.click();
    await expect(page).toHaveURL(/\/en\/solutions\/$/);
    await page.waitForTimeout(800);
    const seen = await durations(page);
    expect(seen.length).toBeGreaterThan(0);
    for (const d of seen) expect(d).toBeLessThanOrEqual(150);
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('no transition animation runs and navigation still works', async ({ page }) => {
      await page.goto('/en/');
      await recordTransition(page);
      const link = page.getByRole('link', { name: 'Explore solutions' });
      await link.hover();
      await page.waitForTimeout(200);
      await link.click();
      await expect(page).toHaveURL(/\/en\/solutions\/$/);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'atlas');
      await page.waitForTimeout(800);
      expect(await durations(page)).toEqual([]);
    });
  });
});

test.describe('state after a prefetched navigation', () => {
  test('theme, hunt progress and the header menu survive', async ({ page }) => {
    await page.goto('/en/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'nexus');
    const spot = page.locator('[data-hunt-spot="debug-flag"]');
    await spot.scrollIntoViewIfNeeded();
    await spot.click();
    await expect(page.locator('[data-hud-toggle]')).toContainText('1/5');

    const menu = page.locator('[data-menu-button]');
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    const all = page.locator('#solutions-menu a.mega__all');
    await all.hover();
    await page.waitForTimeout(200);
    await all.click();
    await expect(page).toHaveURL(/\/en\/solutions\/$/);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'atlas');
    await expect(page.locator('[data-menu-button]')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#solutions-menu')).toBeHidden();
    await expect(page.locator('[data-hud-toggle]')).toContainText('1/5');

    const logo = page.locator('header .logo');
    await logo.hover();
    await page.waitForTimeout(200);
    await logo.click();
    await expect(page).toHaveURL(/\/en\/$/);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'nexus');
    await expect(page.locator('[data-hud-toggle]')).toContainText('1/5');
  });

  test('back and forward reuse the cache and do not refetch the visited page', async ({ page }) => {
    const t = track(page);
    await page.goto('/en/');
    const link = page.getByRole('link', { name: 'Explore solutions' });
    await link.hover();
    await page.waitForTimeout(200);
    await link.click();
    await expect(page).toHaveURL(/\/en\/solutions\/$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/en\/$/);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'nexus');
    expect(t.to('/en/').filter((e) => e.type === 'fetch').length).toBeLessThanOrEqual(1);

    const again = page.getByRole('link', { name: 'Explore solutions' });
    await again.hover();
    await page.waitForTimeout(200);
    await again.click();
    await expect(page).toHaveURL(/\/en\/solutions\/$/);
    await page.waitForTimeout(300);
    expect(t.to('/en/solutions/')).toHaveLength(1);
  });
});
