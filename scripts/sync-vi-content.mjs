// Keeps Vietnamese MDX placeholders in step with their English source. Run: npm run vi:content
// - Creates a "[VI] " placeholder for every English entry that has no vi counterpart.
// - Regenerates a vi file whose body still carries the marker line "[VI] Translate this entry."
//   (it is still a placeholder, so a stale copy would keep outdated English text).
// - vi files with no English counterpart (old slugs) are deleted when they carry the marker;
//   otherwise a warning is printed and the file is left alone.
// Real translations (files without the marker) are never touched.
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
  unlinkSync,
} from 'node:fs';
import { join } from 'node:path';

const COLLECTIONS = ['posts', 'cases', 'jobs'];
const TEXT_KEYS = new Set(['title', 'description', 'label', 'sector']);
const MARK = '[VI] ';
const MARKER_LINE = `${MARK}Translate this entry.`;
let created = 0;
let regenerated = 0;
let deleted = 0;
let warnings = 0;

function placeholder(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error('Missing frontmatter');
  const [, front, body] = match;
  const frontOut = front
    .split(/\r?\n/)
    .map((line) => {
      const m = line.match(/^(\s*(?:- )?)([A-Za-z]+):\s*"(.*)"\s*$/);
      if (m && TEXT_KEYS.has(m[2])) return `${m[1]}${m[2]}: "${MARK}${m[3]}"`;
      return line;
    })
    .join('\n');
  const note = `${MARKER_LINE} The English original follows.\n\n`;
  return `---\n${frontOut}\n---\n\n${note}${body.trimStart()}`;
}

const isPlaceholder = (text) => text.includes(MARKER_LINE);

for (const col of COLLECTIONS) {
  const enDir = join('src/content', col, 'en');
  const viDir = join('src/content', col, 'vi');
  if (!existsSync(enDir)) continue;
  mkdirSync(viDir, { recursive: true });
  const enNames = new Set(readdirSync(enDir));
  for (const name of enNames) {
    const target = join(viDir, name);
    const fresh = placeholder(readFileSync(join(enDir, name), 'utf8'));
    if (!existsSync(target)) {
      writeFileSync(target, fresh);
      created++;
      console.log(`created ${target}`);
      continue;
    }
    const current = readFileSync(target, 'utf8');
    if (isPlaceholder(current) && current !== fresh) {
      writeFileSync(target, fresh);
      regenerated++;
      console.log(`regenerated ${target}`);
    }
  }
  for (const name of readdirSync(viDir)) {
    if (enNames.has(name)) continue;
    const orphan = join(viDir, name);
    if (isPlaceholder(readFileSync(orphan, 'utf8'))) {
      unlinkSync(orphan);
      deleted++;
      console.log(`deleted ${orphan} (no English source)`);
    } else {
      warnings++;
      console.warn(`warning: ${orphan} has no English source but is translated; left as is`);
    }
  }
}
console.log(
  `vi content synced: ${created} created, ${regenerated} regenerated, ${deleted} deleted, ${warnings} warning(s).`,
);
