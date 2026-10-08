import { expect, test } from '@playwright/test';

/** Phrases that would claim an unverified credential, market or commitment (design §10.4). */
const BANNED = [
  'CREST',
  'PCI QSA',
  'OSCP',
  'OSCE',
  'CISSP',
  'GIAC',
  'SOC 2 Type II',
  'ISO/IEC 27001',
  'certified',
  'Asia-Pacific',
  'business day',
];

const PAGES = ['/en/', '/vi/', '/en/about/', '/vi/about/', '/en/contact/'];

for (const url of PAGES) {
  test(`${url} makes no unverified credential or market claim`, async ({ page }) => {
    await page.goto(url);
    const { text, educationalWithClaims } = await page.evaluate(() => {
      const root = document.createElement('div');
      for (const sel of ['header', 'main', 'footer'])
        document.querySelectorAll(sel).forEach((el) => root.append(el.cloneNode(true)));
      // Educational mentions (glossary-style explanations) are allowed; strip them before scanning.
      root.querySelectorAll('[data-educational]').forEach((el) => el.remove());
      const bad = [...document.querySelectorAll('[data-educational]')].filter((el) =>
        /certified|Type II/.test(el.textContent ?? ''),
      ).length;
      return { text: root.textContent ?? '', educationalWithClaims: bad };
    });
    for (const phrase of BANNED) expect(text, phrase).not.toContain(phrase);
    expect(educationalWithClaims).toBe(0);
  });
}
