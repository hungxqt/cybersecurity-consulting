// Merge new English keys into src/i18n/en.json and sync vi.json.
// Usage: node scripts/add-keys.mjs path/to/new-keys.json
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const file = process.argv[2];
if (!file) throw new Error('Usage: node scripts/add-keys.mjs <keys.json>');
const en = JSON.parse(readFileSync('src/i18n/en.json', 'utf8'));
const add = JSON.parse(readFileSync(file, 'utf8'));
let n = 0;
for (const [k, v] of Object.entries(add)) {
  if (en[k] !== v) n++;
  en[k] = v;
}
writeFileSync('src/i18n/en.json', JSON.stringify(en, null, 2) + '\n');
console.log(`en.json: ${n} key(s) added or changed`);
execFileSync('node', ['scripts/sync-vi.mjs'], { stdio: 'inherit' });
