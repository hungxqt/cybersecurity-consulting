// Measures client-side navigation speed on a built site under Slow-4G.
// Usage: node scripts/measure-nav.mjs --label before|after [--runs 3] [--cpu 4] [--url /en/]
// Run `npm run build` first. Serves ./dist on port 4399 and writes .agents/tasks/navspeed/nav-<label>.json.
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const label = opt('label', 'run');
const runs = Math.max(1, Number(opt('runs', '3')));
const cpu = Number(opt('cpu', '1'));
const startPath = opt('url', '/en/');
const PORT = 4399;
const ORIGIN = `http://localhost:${PORT}`;
const OUT_DIR = '.agents/tasks/navspeed';

const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};
const server = createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  let file = join('dist', p);
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const ext = extname(file);
    res.writeHead(200, {
      'content-type': types[ext] ?? 'application/octet-stream',
      // Hashed assets are immutable in production; HTML must never be served from the HTTP cache here.
      'cache-control': p.startsWith('/_astro/')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end('nf');
  }
}).listen(PORT);

/** Scenarios: each starts in a fresh context. `link` is clicked; `mode` decides what happens before the click. */
const SCENARIOS = [
  { name: 'cold', from: startPath, link: 'a[href="/en/solutions/"]', mode: 'cold' },
  { name: 'hover', from: startPath, link: 'a[href="/en/solutions/"]', mode: 'hover' },
  { name: 'idle', from: startPath, link: 'a[href="/en/experience/"]', mode: 'idle' },
  { name: 'touch', from: startPath, link: 'a[href="/en/solutions/"]', mode: 'touch' },
  {
    name: 'cold-hop2',
    from: '/en/solutions/',
    link: 'a[href="/en/solutions/consulting/"]',
    mode: 'cold',
  },
  {
    name: 'hover-hop2',
    from: '/en/solutions/',
    link: 'a[href="/en/solutions/consulting/"]',
    mode: 'hover',
  },
];

const median = (xs) => {
  const v = xs.filter((x) => typeof x === 'number').sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

async function runOnce(browser, sc) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    hasTouch: sc.mode === 'touch',
    reducedMotion: 'no-preference',
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });

  await page.addInitScript(() => {
    const w = window;
    w.__nav = {};
    document.addEventListener(
      'click',
      () => {
        w.__nav.click = performance.now();
      },
      { capture: true },
    );
    document.addEventListener('astro:before-preparation', () => {
      w.__nav.prep = performance.now();
    });
    document.addEventListener('astro:after-swap', () => {
      w.__nav.swap = performance.now();
    });
    document.addEventListener('astro:page-load', () => {
      if (w.__nav.click === undefined) return;
      const check = () => {
        const h1 = document.querySelector('h1');
        if (h1 && h1.getClientRects().length) w.__nav.h1 = performance.now();
        else requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
  });

  await page.goto(ORIGIN + sc.from, { waitUntil: 'load' });
  // Every request from page load until the navigation ends, including the prefetch before the click.
  const everySinceLoad = [];
  page.on('request', (r) => everySinceLoad.push(new URL(r.url()).pathname));
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(sc.mode === 'idle' ? 7000 : 600);

  const link = page.locator(sc.link).locator('visible=true').first();
  const targetPath = new URL(await link.getAttribute('href'), ORIGIN).pathname;
  await link.scrollIntoViewIfNeeded();

  if (sc.mode === 'hover') {
    await link.hover();
    await page.waitForTimeout(300);
  } else if (sc.mode === 'touch') {
    await link.dispatchEvent('pointerdown', { pointerType: 'touch' });
    await page.waitForTimeout(50);
  }

  const reqs = [];
  let measuring = true;
  page.on('request', (r) => {
    if (measuring) reqs.push({ url: r.url(), type: r.resourceType() });
  });
  const sizes = [];
  const pending = [];
  page.on('response', (res) => {
    if (!measuring) return;
    pending.push(
      res
        .body()
        .then((b) => sizes.push(b.length))
        .catch(() => undefined),
    );
  });

  await link.click();
  await page.waitForFunction(
    (p) => location.pathname === p && window.__nav && window.__nav.h1 !== undefined,
    targetPath,
    { timeout: 30000 },
  );
  await page.waitForTimeout(400);
  measuring = false;
  await Promise.all(pending);

  const nav = await page.evaluate(() => window.__nav);
  const path = (u) => new URL(u).pathname;
  const result = {
    clickToPrep: nav.prep !== undefined ? nav.prep - nav.click : null,
    clickToSwap: nav.swap !== undefined ? nav.swap - nav.click : null,
    clickToH1: nav.h1 - nav.click,
    targetHtmlRequests: reqs.filter((r) => path(r.url) === targetPath).length,
    targetHtmlRequestsTotal: everySinceLoad.filter((p) => p === targetPath).length,
    cssRequests: reqs.filter((r) => r.type === 'stylesheet' || path(r.url).endsWith('.css')).length,
    jsRequests: reqs.filter((r) => r.type === 'script' || path(r.url).endsWith('.js')).length,
    totalRequests: reqs.length,
    bytes: sizes.reduce((n, b) => n + b, 0),
  };
  await ctx.close();
  return result;
}

const browser = await chromium.launch();
const out = {
  label,
  date: new Date().toISOString(),
  runs,
  cpu,
  network: 'Slow 4G (150 ms, 1.6 Mbps down, 750 Kbps up)',
  scenarios: {},
};
try {
  for (const sc of SCENARIOS) {
    const all = [];
    for (let i = 0; i < runs; i++) {
      try {
        all.push(await runOnce(browser, sc));
      } catch (e) {
        all.push({ error: String(e.message ?? e).split('\n')[0] });
      }
    }
    const ok = all.filter((r) => !r.error);
    const med = {};
    for (const k of Object.keys(ok[0] ?? {})) med[k] = median(ok.map((r) => r[k]));
    out.scenarios[sc.name] = {
      from: sc.from,
      link: sc.link,
      mode: sc.mode,
      median: med,
      runs: all,
    };
  }
} finally {
  await browser.close();
  server.close();
}

await mkdir(OUT_DIR, { recursive: true });
await writeFile(join(OUT_DIR, `nav-${label}.json`), JSON.stringify(out, null, 2) + '\n');

const f = (n) => (n === null || n === undefined ? '-' : Math.round(n));
console.log(
  `| scenario | click→swap ms | click→h1 ms | target HTML req after click | target HTML req total | CSS req | JS req | bytes |`,
);
console.log(`| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |`);
for (const [name, s] of Object.entries(out.scenarios)) {
  const m = s.median;
  console.log(
    `| ${name} | ${f(m.clickToSwap)} | ${f(m.clickToH1)} | ${f(m.targetHtmlRequests)} | ${f(m.targetHtmlRequestsTotal)} | ${f(m.cssRequests)} | ${f(m.jsRequests)} | ${f(m.bytes)} |`,
  );
}
