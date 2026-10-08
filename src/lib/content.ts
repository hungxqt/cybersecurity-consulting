import { isLang, type Lang } from './i18n';

/** Entry ids look like "en/my-slug". Pure helpers so they can be unit tested without Astro. */
export function langOf(id: string): Lang | null {
  const first = id.split('/')[0];
  return isLang(first) ? first : null;
}

export function slugOf(id: string): string {
  const i = id.indexOf('/');
  return i === -1 ? id : id.slice(i + 1).replace(/\.(mdx?|md)$/, '');
}

interface Entry {
  id: string;
  data: { date: Date; draft?: boolean };
}

/** Published entries for one language, newest first. */
export function forLang<T extends Entry>(entries: T[], lang: Lang): T[] {
  return entries
    .filter((e) => langOf(e.id) === lang && !e.data.draft)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

interface Taggable extends Entry {
  data: Entry['data'] & { tags: string[] };
}

/** Other entries ranked by number of shared tags, then recency. Zero-overlap entries only fill gaps. */
export function relatedByTags<T extends Taggable>(current: T, candidates: T[], limit = 2): T[] {
  const own = new Set(current.data.tags);
  return candidates
    .filter((c) => c.id !== current.id)
    .map((c) => ({ c, score: c.data.tags.filter((t) => own.has(t)).length }))
    .sort((a, b) => b.score - a.score || b.c.data.date.getTime() - a.c.data.date.getTime())
    .slice(0, limit)
    .map((x) => x.c);
}

/** Reading time in whole minutes at ~200 wpm, never below 1. Strips code fences and markup noise. */
export function readingMinutes(markdown: string): number {
  const text = markdown.replace(/```[\s\S]*?```/g, ' ').replace(/[#>*_`\-[\]()!]/g, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/* ---- Authenticity helpers (design §10.4) ---- */

interface CredentialLike {
  id: string;
  publish: boolean;
}

/** Certifications that are verified and cleared for publication. Nothing else may be rendered. */
export function publishedCredentials<T extends CredentialLike>(entries: T[]): T[] {
  return entries.filter((e) => e.publish);
}

interface TeamLike {
  publish: boolean;
  credentials: string[];
}

/**
 * Published team members only; each member's credentials are narrowed to published certifications,
 * so an unpublished credential can never reach a page.
 */
export function publishedTeam<M extends TeamLike, C extends CredentialLike>(
  team: M[],
  certs: C[],
): M[] {
  const ok = new Set(publishedCredentials(certs).map((c) => c.id));
  return team
    .filter((m) => m.publish)
    .map((m) => ({ ...m, credentials: m.credentials.filter((c) => ok.has(c)) }));
}

interface CaseLike {
  data: { illustrative: boolean; verified: boolean; metrics?: unknown[] | undefined };
}

/** Cases that are real client references: not illustrative and verified. */
export function verifiedCases<T extends CaseLike>(entries: T[]): T[] {
  return entries.filter((e) => e.data.illustrative === false && e.data.verified);
}

export interface CaseView {
  banner: boolean;
  metrics: boolean;
  referenceLabel: 'cases.reference' | null;
}

/** What a scenario page may show: the banner iff illustrative; metrics and the label only when verified. */
export function caseView(entry: CaseLike): CaseView {
  const { illustrative, verified, metrics } = entry.data;
  const real = !illustrative && verified;
  return {
    banner: illustrative === true,
    metrics: real && (metrics?.length ?? 0) > 0,
    referenceLabel: real ? 'cases.reference' : null,
  };
}

export function formatDate(date: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
