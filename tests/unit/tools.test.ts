import { describe, expect, it } from 'vitest';
import { QUESTIONS, levelFor, radarPoints, scoreQuiz, summarizeQuiz } from '@/lib/quizScore';
import { AREAS, applicableAreas, isShared, timeline } from '@/lib/compliance';

const all = (n: number) => QUESTIONS.map(() => n);

describe('quiz scoring', () => {
  it('scores all zeros as 0 / initial and all threes as 100 / managed', () => {
    expect(scoreQuiz(all(0))).toMatchObject({
      overall: 0,
      level: 'initial',
      focus: ['govern', 'protect'],
    });
    const top = scoreQuiz(all(3))!;
    expect(top.overall).toBe(100);
    expect(top.level).toBe('managed');
    expect(top.focus).toEqual([]);
  });
  it('computes per-domain scores', () => {
    const r = scoreQuiz([3, 3, 0, 0, 1, 2, 3, 3])!;
    expect(r.perDomain).toEqual({ govern: 100, protect: 0, detect: 50, respond: 100 });
    expect(r.overall).toBe(Math.round((15 / 24) * 100));
    expect(r.focus).toEqual(['protect', 'detect']);
  });
  it('rejects incomplete or invalid answers', () => {
    expect(scoreQuiz([])).toBeNull();
    expect(scoreQuiz(all(1).slice(0, 7))).toBeNull();
    expect(scoreQuiz([...all(1).slice(0, 7), null])).toBeNull();
    expect(scoreQuiz([...all(1).slice(0, 7), 4])).toBeNull();
    expect(scoreQuiz([...all(1).slice(0, 7), 1.5])).toBeNull();
    expect(scoreQuiz([...all(1).slice(0, 7), -1])).toBeNull();
  });
  it('level thresholds', () => {
    expect([0, 24, 25, 49, 50, 74, 75, 100].map(levelFor)).toEqual([
      'initial',
      'initial',
      'developing',
      'developing',
      'defined',
      'defined',
      'managed',
      'managed',
    ]);
  });
  it('radar points start at the top and clamp values', () => {
    expect(radarPoints([100, 0, 0, 0], 100, 100, 100).split(' ')[0]).toBe('100.0,0.0');
    expect(radarPoints([150, -5], 10, 0, 0).split(' ')[0]).toBe('0.0,-10.0');
  });
  it('summary includes every domain', () => {
    const s = summarizeQuiz(scoreQuiz(all(2))!);
    for (const d of ['govern', 'protect', 'detect', 'respond']) expect(s).toContain(d);
  });
});

describe('compliance matrix', () => {
  it('is empty with no selection', () => {
    expect(applicableAreas([])).toEqual([]);
    expect(timeline([]).total).toBe(0);
  });
  it('covers every area for any selection and ranks core first', () => {
    const rows = applicableAreas(['soc2']);
    expect(rows.map((r) => r.area).sort()).toEqual([...AREAS].sort());
    const ranks = rows.map((r) => ({ core: 3, partial: 2, light: 1 })[r.level]);
    expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
    expect(rows.find((r) => r.area === 'physical')!.level).toBe('light');
  });
  it('takes the strongest requirement across frameworks', () => {
    const row = applicableAreas(['soc2', 'pci']).find((r) => r.area === 'physical')!;
    expect(row.level).toBe('core');
    expect(row.byFramework).toEqual({ soc2: 'light', pci: 'core' });
  });
  it('single-framework timeline equals its data, and combined is less than the sum', () => {
    expect(timeline(['iso27001'])).toEqual({
      phases: { gap: 3, remediate: 14, audit: 4 },
      total: 21,
    });
    const both = timeline(['iso27001', 'soc2']).total;
    expect(both).toBeGreaterThan(timeline(['iso27001']).total);
    expect(both).toBeLessThan(timeline(['iso27001']).total + timeline(['soc2']).total);
  });
  it('ignores selection order', () => {
    expect(timeline(['pci', 'iso27001'])).toEqual(timeline(['iso27001', 'pci']));
  });
});

describe('compliance overlap', () => {
  const rows = (sel: ('iso27001' | 'soc2' | 'pci')[]) => applicableAreas(sel);
  it('marks core areas required by two selected frameworks as shared', () => {
    const r = rows(['iso27001', 'soc2']).find((x) => x.area === 'access')!;
    expect(isShared(r, 'iso27001', ['iso27001', 'soc2'])).toBe(true);
    expect(isShared(r, 'soc2', ['iso27001', 'soc2'])).toBe(true);
  });
  it('never marks a single selection, partial or light levels', () => {
    const one = rows(['soc2']).find((x) => x.area === 'access')!;
    expect(isShared(one, 'soc2', ['soc2'])).toBe(false);
    const two = rows(['iso27001', 'soc2']).find((x) => x.area === 'crypto')!;
    expect(isShared(two, 'iso27001', ['iso27001', 'soc2'])).toBe(false);
    expect(isShared(two, 'soc2', ['iso27001', 'soc2'])).toBe(false);
  });
  it('is deterministic for a given selection', () => {
    const sel = ['iso27001', 'soc2', 'pci'] as const;
    const a = rows([...sel]).map((r) => sel.map((f) => isShared(r, f, sel)));
    const b = rows([...sel]).map((r) => sel.map((f) => isShared(r, f, sel)));
    expect(a).toEqual(b);
  });
});
