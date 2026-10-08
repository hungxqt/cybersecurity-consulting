/**
 * Dependency-free string templating, safe to import from client scripts (it does not pull in
 * the i18n dictionaries; see tests/unit/client-imports.test.ts).
 * Replace {name} tokens. Unknown tokens are left untouched so mistakes stay visible.
 */
export function interpolate(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
