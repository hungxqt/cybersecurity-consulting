import { describe, expect, it } from 'vitest';
import { FEED, SECTORS, SEVERITIES, filterFeed, monthsOf } from '@/lib/feed';
import { ROUNDS, isCorrect, scoreGame, verdictFor } from '@/lib/phishGame';
import { TERM_IDS, normalize, searchTerms } from '@/lib/glossary';
import { dictionaries } from '@/lib/i18n';

describe('threat feed', () => {
  it('is sorted newest first and uses known severities and sectors', () => {
    const dates = FEED.map((e) => e.date);
    expect(dates).toEqual([...dates].sort().reverse());
    for (const e of FEED) {
      expect(SEVERITIES).toContain(e.severity);
      for (const s of e.sectors) expect(SECTORS).toContain(s);
    }
  });
  it('filters by each dimension and combinations', () => {
    expect(filterFeed(FEED, {})).toHaveLength(FEED.length);
    expect(filterFeed(FEED, { severity: 'all', sector: 'all', month: 'all' })).toHaveLength(
      FEED.length,
    );
    const crit = filterFeed(FEED, { severity: 'critical' });
    expect(crit.length).toBeGreaterThan(0);
    expect(crit.every((e) => e.severity === 'critical')).toBe(true);
    const health = filterFeed(FEED, { sector: 'healthcare' });
    expect(health.every((e) => e.sectors.includes('healthcare'))).toBe(true);
    const sep = filterFeed(FEED, { month: '2026-09' });
    expect(sep.every((e) => e.date.startsWith('2026-09'))).toBe(true);
    const combo = filterFeed(FEED, {
      severity: 'critical',
      sector: 'healthcare',
      month: '2026-09',
    });
    expect(combo.map((e) => e.id)).toEqual([11]);
    expect(filterFeed(FEED, { severity: 'low', sector: 'finance' })).toEqual([]);
  });
  it('lists months newest first', () => {
    expect(monthsOf(FEED)).toEqual(['2026-09', '2026-08']);
  });
  it('every entry has English and Vietnamese text keys', () => {
    for (const e of FEED)
      for (const lang of ['en', 'vi'] as const) {
        expect(dictionaries[lang][`feed.${e.id}.title`]).toBeTruthy();
        expect(dictionaries[lang][`feed.${e.id}.summary`]).toBeTruthy();
      }
  });
});

describe('phish game', () => {
  it('has ten rounds with a mix of phish and legit', () => {
    expect(ROUNDS).toHaveLength(10);
    const phish = ROUNDS.filter((r) => r.phish).length;
    expect(phish).toBeGreaterThanOrEqual(4);
    expect(phish).toBeLessThanOrEqual(7);
  });
  it('scores perfect, zero and partial games', () => {
    expect(scoreGame(ROUNDS.map((r) => r.phish))).toBe(10);
    expect(scoreGame(ROUNDS.map((r) => !r.phish))).toBe(0);
    expect(scoreGame([])).toBe(0);
    expect(scoreGame([ROUNDS[0]!.phish, null, undefined])).toBe(1);
  });
  it('checks single answers and verdict bands', () => {
    expect(isCorrect(ROUNDS[0]!, true)).toBe(true);
    expect(isCorrect(ROUNDS[1]!, true)).toBe(false);
    expect([10, 9, 8, 6, 5, 0].map(verdictFor)).toEqual([
      'high',
      'high',
      'mid',
      'mid',
      'low',
      'low',
    ]);
  });
  it('every round has all text fields in both languages', () => {
    for (const r of ROUNDS)
      for (const lang of ['en', 'vi'] as const) {
        for (const f of ['sender', 'subject', 'body', 'why'])
          expect(dictionaries[lang][`phish.${r.id}.${f}`]).toBeTruthy();
      }
  });
});

describe('glossary search', () => {
  const terms = TERM_IDS.map((id) => ({
    id,
    term: dictionaries.en[`gloss.${id}.term`]!,
    def: dictionaries.en[`gloss.${id}.def`]!,
  }));
  it('returns everything A-Z for an empty query', () => {
    const all = searchTerms(terms, '  ');
    expect(all).toHaveLength(TERM_IDS.length);
    const names = all.map((t) => normalize(t.term));
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
  it('matches names and definitions, case-insensitively', () => {
    expect(searchTerms(terms, 'RANSOMWARE').map((t) => t.id)).toContain('ransomware');
    expect(searchTerms(terms, 'encrypts').map((t) => t.id)).toContain('ransomware');
  });
  it('requires every word to match', () => {
    expect(searchTerms(terms, 'two proofs').map((t) => t.id)).toEqual(['mfa']);
    expect(searchTerms(terms, 'ransomware zzzz')).toEqual([]);
  });
  it('ignores Vietnamese diacritics', () => {
    expect(normalize('Tiếng Việt đẹp')).toBe('tieng viet dep');
    const vi = [{ id: 'x', term: 'Tấn công', def: 'Bề mặt tấn công' }];
    expect(searchTerms(vi, 'tan cong')).toHaveLength(1);
    expect(searchTerms(vi, 'be mat')).toHaveLength(1);
  });
  it('has every term in both languages', () => {
    for (const id of TERM_IDS)
      for (const lang of ['en', 'vi'] as const) {
        expect(dictionaries[lang][`gloss.${id}.term`]).toBeTruthy();
        expect(dictionaries[lang][`gloss.${id}.def`]).toBeTruthy();
      }
  });
});
