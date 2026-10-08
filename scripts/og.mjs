// Generates public/og/en.png and public/og/vi.png (1200x630) from the hero headline.
// Look (design §10.1 row 22): Carbon background, hairline rules only, the two-tone hero title in
// Be Vietnam Pro 300 (Ash then Frost), mono wordmark and kicker. No accent colour, no glow.
// Run after changing the headline or translations: npm run og
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const bvp = (subset) =>
  resolve(
    `node_modules/@fontsource/be-vietnam-pro/files/be-vietnam-pro-${subset}-300-normal.woff2`,
  );
const mono = resolve(
  'node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2',
);
const url = (p) => pathToFileURL(p).href;
const strip = (s) => s.replace(/^\[VI\]\s*/, '');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Unicode ranges copied from @fontsource/be-vietnam-pro/300.css so each subset covers its own glyphs.
const RANGES = {
  latin:
    'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  'latin-ext':
    'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
  vietnamese:
    'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB',
};
const faces = Object.entries(RANGES)
  .map(
    ([subset, range]) =>
      `@font-face{font-family:B;font-weight:300;src:url(${url(bvp(subset))});unicode-range:${range}}`,
  )
  .join('\n');

function html({ dim, strong, tagline, eyebrow, name }) {
  return `<!doctype html><meta charset="utf-8"><style>
${faces}
@font-face{font-family:M;src:url(${url(mono)});font-weight:100 800}
*{box-sizing:border-box}
body{margin:0;width:1200px;height:630px;background:#0D0F11;color:#E8ECEF;font-family:B,sans-serif;font-weight:300;position:relative;overflow:hidden}
.rule{position:absolute;left:72px;right:72px;height:1px;background:#2C323A}
.top{top:112px}.bottom{bottom:112px}
.brand{position:absolute;left:72px;top:56px;font-family:M;font-weight:500;font-size:26px;letter-spacing:.02em}
.kicker{position:absolute;right:72px;top:60px;font-family:M;font-weight:500;font-size:18px;letter-spacing:.1em;text-transform:uppercase;color:#98A2AC}
h1{position:absolute;left:72px;right:72px;top:152px;margin:0;font-weight:300;font-size:80px;line-height:1.1;letter-spacing:-.03em;color:#98A2AC}
h1 b{font-weight:300;color:#E8ECEF}
.tagline{position:absolute;left:72px;right:72px;bottom:56px;font-size:26px;line-height:1.4;color:#98A2AC}
</style>
<div class="brand">${esc(name)}</div><div class="kicker">${esc(eyebrow)}</div>
<div class="rule top"></div>
<h1>${esc(dim)} <b>${esc(strong)}</b></h1>
<div class="rule bottom"></div>
<div class="tagline">${esc(tagline)}</div>`;
}

const out = 'public/og';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const lang of ['en', 'vi']) {
  const d = JSON.parse(readFileSync(`src/i18n/${lang}.json`, 'utf8'));
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  const tmp = resolve(`scripts/.og-${lang}.html`);
  writeFileSync(
    tmp,
    html({
      dim: strip(d['hero.title.dim']),
      strong: strip(d['hero.title.strong']),
      tagline: strip(d['site.tagline']),
      eyebrow: strip(d['hero.eyebrow']),
      name: strip(d['site.name']),
    }),
  );
  await page.goto(pathToFileURL(tmp).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${out}/${lang}.png` });
  await page.close();
  rmSync(tmp);
  console.log(`wrote ${out}/${lang}.png`);
}
await browser.close();
