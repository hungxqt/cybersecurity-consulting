export const TERM_IDS = [
  'mfa',
  'phishing',
  'ransomware',
  'siem',
  'soc',
  'edr',
  'zeroday',
  'pentest',
  'threatmodel',
  'iso27001',
  'soc2',
  'pci',
  'mttd',
  'mttr',
  'attacksurface',
  'leastprivilege',
] as const;

export interface Term {
  id: string;
  term: string;
  def: string;
}

/** Lowercase, strip diacritics (including Vietnamese đ) and collapse whitespace for forgiving search. */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Terms whose name or definition contains every word of the query. Empty query returns everything, A-Z. */
export function searchTerms(terms: readonly Term[], query: string): Term[] {
  const words = normalize(query).split(' ').filter(Boolean);
  const sorted = [...terms].sort((a, b) => normalize(a.term).localeCompare(normalize(b.term)));
  if (words.length === 0) return sorted;
  return sorted.filter((t) => {
    const hay = normalize(`${t.term} ${t.def}`);
    return words.every((w) => hay.includes(w));
  });
}
