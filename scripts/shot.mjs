// Dev helper: node scripts/shot.mjs <path> <out.png> [width] [height] [scrollY] [waitMs] [reduced]
// Serves ./dist itself on port 4399 (run `npm run build` first), screenshots, exits.
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const [path, out, w = '1440', h = '900', scrollY = '0', wait = '5000', reduced = ''] =
  process.argv.slice(2);
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};
const server = createServer(async (req, res) => {
  let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  let file = join('dist', p);
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end('nf');
  }
}).listen(4399);

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({
  viewport: { width: +w, height: +h },
  reducedMotion: reduced ? 'reduce' : 'no-preference',
});
const page = await ctx.newPage();
const logs = [];
page.on(
  'console',
  (m) => ['error', 'warning'].includes(m.type()) && logs.push(`${m.type()}: ${m.text()}`),
);
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(`http://localhost:4399${path}`, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-nexus][data-live], [data-journey][data-live]', { timeout: 5000 }).catch(() => {});
if (+scrollY) await page.evaluate((y) => window.scrollTo(0, y), +scrollY);
await page.waitForTimeout(+wait);
await page.screenshot({ path: out });
console.log(logs.length ? logs.join('\n') : 'no console errors');
console.log(
  'live:',
  await page.evaluate(() => !!document.querySelector('[data-nexus][data-live], [data-journey][data-live]')),
);
await browser.close();
server.close();
