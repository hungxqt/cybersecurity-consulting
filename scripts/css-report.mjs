// Report tool: node scripts/css-report.mjs  (run `npm run build` first)
// Lists the render-blocking stylesheets of every built page: count, raw bytes and gzip (level 6).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name === 'index.html') out.push(p);
  }
  return out;
}

const sizes = new Map();
function sizeOf(href) {
  if (!sizes.has(href)) {
    const buf = readFileSync(join(DIST, href.split('?')[0]));
    sizes.set(href, { raw: buf.length, gz: gzipSync(buf, { level: 6 }).length });
  }
  return sizes.get(href);
}

function sheets(html) {
  const hrefs = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (!/\brel\s*=\s*["']?stylesheet/i.test(tag)) continue;
    if (/\bmedia\s*=\s*["']?print/i.test(tag)) continue;
    const m = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    if (m) hrefs.push(m[1] ?? m[2]);
  }
  return hrefs;
}

const pages = walk(DIST)
  .sort()
  .map((file) => {
    const route = '/' + relative(DIST, file).split(sep).slice(0, -1).join('/');
    const html = readFileSync(file, 'utf8');
    const hrefs = sheets(html);
    const files = hrefs.map((h) => ({ href: h, ...sizeOf(h) }));
    return {
      route: route === '/' ? '/' : route + '/',
      count: hrefs.length,
      raw: files.reduce((n, f) => n + f.raw, 0),
      gz: files.reduce((n, f) => n + f.gz, 0),
      hrefs,
      inlineStyle: /<style[\s>]/i.test(html),
    };
  });

console.log('route | stylesheets | raw B | gzip B');
for (const p of pages) console.log(`${p.route} | ${p.count} | ${p.raw} | ${p.gz}`);

console.log('\ndistinct stylesheet files:');
const distinct = [...new Set(pages.flatMap((p) => p.hrefs))].sort();
for (const h of distinct) {
  const s = sizeOf(h);
  console.log(
    `${h} | raw ${s.raw} B | gzip ${s.gz} B | used by ${pages.filter((p) => p.hrefs.includes(h)).length} pages`,
  );
}
console.log(`distinct files: ${distinct.length}`);

const withCss = pages.filter((p) => p.count > 0);
const largest = withCss.reduce((a, b) => (b.raw > a.raw ? b : a), withCss[0]);
if (largest) {
  console.log(
    `\nlargest page: ${largest.route} (${largest.count} files, ${largest.raw} B raw, ${largest.gz} B gzip)`,
  );
}
const home = pages.find((p) => p.route === '/en/');
if (home) {
  console.log(`/en/: ${home.count} files, ${home.raw} B raw, ${home.gz} B gzip`);
}
const by = (pred) => pages.filter(pred).length;
console.log(
  `\npages: ${pages.length} | with 0 sheets: ${by((p) => p.count === 0)} | with 1: ${by((p) => p.count === 1)} | with >1: ${by((p) => p.count > 1)}`,
);
console.log(`pages with inline <style>: ${by((p) => p.inlineStyle)}`);
