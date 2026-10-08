import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const FORMSPREE = 'https://formspree.io/f/testform';

async function fillValid(page: Page) {
  await page.getByLabel('Your name').fill('Sam Doe');
  await page.getByLabel('Work email').fill('sam@example.com');
  await page.getByLabel('What do you need?').selectOption('soc');
  await page
    .getByLabel('Message', { exact: true })
    .fill('We need 24/7 monitoring for our cloud estate.');
  await page.getByLabel('I agree that HungTran may contact me about this request.').check();
}

test('shows an accessible error for each invalid field and focuses the first', async ({ page }) => {
  await page.goto('/en/contact/');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('[data-summary]')).toHaveText('Fix 5 field(s) to send your message.');
  for (const [id, text] of [
    ['c-name', /Enter your name/],
    ['c-email', /valid email/],
    ['c-topic', /Choose what you need/],
    ['c-message', /at least 10 characters/],
    ['c-consent', /Tick the box/],
  ] as const) {
    const input = page.locator(`#${id}`);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator(`#${id}-err`)).toHaveText(text);
    await expect(input).toHaveAttribute('aria-describedby', new RegExp(`${id}-err`));
  }
  await expect(page.locator('#c-name')).toBeFocused();

  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);

  // Typing clears that field's error.
  await page.locator('#c-name').fill('A');
  await expect(page.locator('#c-name-err')).toBeEmpty();
  await expect(page.locator('#c-name')).not.toHaveAttribute('aria-invalid', 'true');
});

test('rejects a malformed email', async ({ page }) => {
  await page.goto('/en/contact/');
  await fillValid(page);
  await page.getByLabel('Work email').fill('not-an-email');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('#c-email-err')).toContainText('valid email');
  await expect(page.locator('#c-email')).toBeFocused();
});

test('submits to Formspree (mocked) and shows the success state', async ({ page }) => {
  let payload: Record<string, string> | null = null;
  await page.route(FORMSPREE, async (route) => {
    payload = route.request().postDataJSON();
    expect(route.request().method()).toBe('POST');
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.goto('/en/contact/');
  await fillValid(page);
  await page.locator('#c-company').fill('Acme');
  await page.getByRole('button', { name: 'Send message' }).click();

  const ok = page.locator('[data-ok]');
  await expect(ok).toBeVisible();
  await expect(ok).toBeFocused();
  await expect(ok).toContainText('Thanks, Sam Doe. An analyst will reply to sam@example.com.');
  expect(payload).toMatchObject({
    name: 'Sam Doe',
    email: 'sam@example.com',
    company: 'Acme',
    topic: 'soc',
    _gotcha: '',
  });

  await ok.getByRole('button', { name: 'Send another message' }).click();
  await expect(page.locator('#c-name')).toHaveValue('');
  await expect(page.locator('[data-form]')).toBeVisible();
});

test('shows an error state when Formspree fails, and keeps what was typed', async ({ page }) => {
  await page.route(FORMSPREE, (route) => route.fulfill({ status: 500, body: 'nope' }));
  await page.goto('/en/contact/');
  await fillValid(page);
  await page.getByRole('button', { name: 'Send message' }).click();
  const fail = page.locator('[data-fail]');
  await expect(fail).toBeVisible();
  await expect(fail).toContainText('We could not send your message');
  await expect(fail).toContainText('info@hungtran.id.vn');
  await expect(page.locator('#c-name')).toHaveValue('Sam Doe');
  await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled();
});

test('a filled honeypot never reaches the network but looks like success', async ({ page }) => {
  let called = false;
  await page.route(FORMSPREE, (route) => {
    called = true;
    return route.fulfill({ status: 200, body: '{}' });
  });
  await page.goto('/en/contact/');
  await fillValid(page);
  await page
    .locator('#c-website')
    .evaluate((el: HTMLInputElement) => (el.value = 'http://spam.example'));
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('[data-ok]')).toBeVisible();
  expect(called).toBe(false);
});

test('prefills from the maturity quiz', async ({ page }) => {
  await page.goto(
    '/en/contact/?quiz=' + encodeURIComponent('Security maturity quiz: overall 50/100 (defined).'),
  );
  await expect(page.getByLabel('Message', { exact: true })).toHaveValue(/overall 50\/100/);
  await expect(page.getByLabel('What do you need?')).toHaveValue('consulting');
});

test('the careers page links to the contact form with the careers topic', async ({ page }) => {
  await page.goto('/en/careers/');
  const cta = page.getByRole('link', { name: 'Send us your details' });
  await expect(cta).toHaveAttribute('href', '/en/contact/?topic=careers');
  await cta.click();
  await expect(page.getByLabel('What do you need?')).toHaveValue('careers');
  await expect(page.locator('#c-role, [name="role"], [data-role-field]')).toHaveCount(0);
});

test('ignores an unknown or malicious topic parameter', async ({ page }) => {
  await page.goto('/en/contact/?topic=%3Cscript%3Ealert(1)%3C/script%3E');
  await expect(page.getByLabel('What do you need?')).toHaveValue('');
  await page.goto('/en/contact/?topic=nope');
  await expect(page.getByLabel('What do you need?')).toHaveValue('');
});
test('about page renders values and expertise', async ({ page }) => {
  await page.goto('/en/about/');
  await expect(page.getByRole('heading', { name: 'How we work' })).toBeVisible();
  await expect(page.locator('#expertise [data-discipline]')).toHaveCount(5);
  for (const cls of ['.team', '.certs', '.timeline'])
    await expect(page.locator(cls)).toHaveCount(0);
  await expect(page.getByText('Owner content')).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
});
