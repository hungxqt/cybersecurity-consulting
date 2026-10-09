// Lists remaining "[VI]" placeholders in the dictionary and MDX content.
// The release build uses --strict to reject unfinished translations.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const hits = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(mdx?|json|ya?ml)$/.test(name)) scan(p);
  }
}
function scan(file) {
  const isVi = /[\\/]vi([\\/.]|$)/.test(file) || file.endsWith('vi.json');
  if (!isVi) return;
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (line.includes('[VI]')) hits.push(`${file}:${i + 1}`);
    });
}

walk('src');
const byFile = new Map();
for (const h of hits) {
  const f = h.slice(0, h.lastIndexOf(':'));
  byFile.set(f, (byFile.get(f) ?? 0) + 1);
}
console.log(`[VI] placeholders remaining: ${hits.length} in ${byFile.size} file(s)`);
for (const [f, n] of byFile) console.log(`  ${String(n).padStart(4)}  ${f}`);
if (process.argv.includes('--strict') && hits.length > 0) process.exit(1);
