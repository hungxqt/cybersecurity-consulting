// Adds any key missing from src/i18n/vi.json as "[VI] <english>", drops keys that no longer
// exist in en.json, refreshes stale "[VI] " placeholders whose English source changed, and keeps
// every real translation (any value not starting with "[VI] ") untouched. Run: npm run vi:sync
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const MARK = '[VI] ';
const en = JSON.parse(readFileSync('src/i18n/en.json', 'utf8'));
const viPath = 'src/i18n/vi.json';
const vi = existsSync(viPath) ? JSON.parse(readFileSync(viPath, 'utf8')) : {};

// Proper nouns, native language names and already-Vietnamese strings are copied as-is.
const VERBATIM = /^(cert\.|lang\.(en|vi)$|site\.name$|tokens\.diacriticsText$)/;

const placeholder = (key, value) => (VERBATIM.test(key) ? value : `${MARK}${value}`);

const out = {};
let added = 0;
let refreshed = 0;
for (const [key, value] of Object.entries(en)) {
  const current = vi[key];
  if (typeof current !== 'string' || current.trim() === '') {
    out[key] = placeholder(key, value);
    added++;
  } else if (current.startsWith(MARK) && current !== `${MARK}${value}`) {
    // A placeholder copies the English text, so a stale one would keep outdated (or removed) copy.
    out[key] = placeholder(key, value);
    refreshed++;
  } else {
    out[key] = current;
  }
}
const removed = Object.keys(vi).filter((k) => !(k in en)).length;
writeFileSync(viPath, JSON.stringify(out, null, 2) + '\n');
console.log(`vi.json synced: ${added} added, ${refreshed} refreshed, ${removed} removed.`);
