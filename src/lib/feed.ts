import raw from '../content/data/threat-feed.json';

export const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export type Severity = (typeof SEVERITIES)[number];
export const SECTORS = [
  'finance',
  'healthcare',
  'logistics',
  'retail',
  'government',
  'tech',
] as const;
export type Sector = (typeof SECTORS)[number];

export interface FeedEntry {
  id: number;
  severity: Severity;
  score: number;
  sectors: Sector[];
  /** ISO date, YYYY-MM-DD. */
  date: string;
}

export const FEED: readonly FeedEntry[] = (raw as FeedEntry[])
  .slice()
  .sort((a, b) => b.date.localeCompare(a.date) || b.score - a.score);

export interface FeedFilter {
  severity?: Severity | 'all';
  sector?: Sector | 'all';
  /** YYYY-MM or 'all'. */
  month?: string;
}

export function filterFeed(entries: readonly FeedEntry[], f: FeedFilter): FeedEntry[] {
  return entries.filter(
    (e) =>
      (!f.severity || f.severity === 'all' || e.severity === f.severity) &&
      (!f.sector || f.sector === 'all' || e.sectors.includes(f.sector)) &&
      (!f.month || f.month === 'all' || e.date.startsWith(f.month)),
  );
}

/** Distinct YYYY-MM values, newest first. */
export function monthsOf(entries: readonly FeedEntry[]): string[] {
  return [...new Set(entries.map((e) => e.date.slice(0, 7)))].sort().reverse();
}
