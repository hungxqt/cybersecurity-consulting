import { describe, expect, it } from 'vitest';
import {
  ATTACK_TYPES,
  ORIGINS,
  OUTCOME_RATES,
  TARGETS,
  createThreatStream,
  formatClock,
  formatTickerLine,
  mulberry32,
  sampleTicker,
} from '@/lib/threatSim';
import { isValidCoord, latLonToXYZ } from '@/lib/geo';

const take = (seed: number, n: number) => {
  const s = createThreatStream(seed);
  return Array.from({ length: n }, () => s.next());
};

describe('PRNG', () => {
  it('is deterministic and within [0,1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
  it('differs between seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe('threat stream', () => {
  it('yields identical events for the same seed', () => {
    expect(take(7, 200)).toEqual(take(7, 200));
  });
  it('yields different events for different seeds', () => {
    expect(take(7, 50)).not.toEqual(take(8, 50));
  });
  it('numbers events from 1', () => {
    expect(take(1, 5).map((e) => e.id)).toEqual([1, 2, 3, 4, 5]);
  });
  it('keeps every field in range', () => {
    const types = new Set<string>(ATTACK_TYPES.map((a) => a.id));
    for (const e of take(99, 2000)) {
      expect(types.has(e.type)).toBe(true);
      expect([1, 2, 3, 4]).toContain(e.severity);
      expect(['blocked', 'contained', 'escalated']).toContain(e.outcome);
      expect(e.latencyMs).toBeGreaterThanOrEqual(12);
      expect(e.latencyMs).toBeLessThanOrEqual(4000);
      expect(e.delayMs).toBeGreaterThanOrEqual(500);
      expect(e.delayMs).toBeLessThanOrEqual(2000);
      expect(e.origin.code).not.toBe(e.target.code);
    }
  });
  it('blocked events are fast, escalations are slow', () => {
    for (const e of take(5, 2000)) {
      if (e.outcome === 'blocked') expect(e.latencyMs).toBeLessThanOrEqual(90);
      if (e.outcome === 'escalated') expect(e.latencyMs).toBeGreaterThanOrEqual(800);
    }
  });
  it('matches the configured outcome rates over a large sample', () => {
    const n = 20000;
    const counts = { blocked: 0, contained: 0, escalated: 0 };
    for (const e of take(2026, n)) counts[e.outcome]++;
    for (const k of Object.keys(OUTCOME_RATES) as (keyof typeof OUTCOME_RATES)[]) {
      expect(Math.abs(counts[k] / n - OUTCOME_RATES[k])).toBeLessThan(0.01);
    }
  });
  it('outcome rates sum to 1', () => {
    expect(Object.values(OUTCOME_RATES).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });
});

describe('places and geometry', () => {
  it('all coordinates are valid and codes unique per list', () => {
    for (const p of [...ORIGINS, ...TARGETS]) expect(isValidCoord(p)).toBe(true);
    expect(new Set(ORIGINS.map((p) => p.code)).size).toBe(ORIGINS.length);
    expect(new Set(TARGETS.map((p) => p.code)).size).toBe(TARGETS.length);
  });
  it('every target is also a known origin city', () => {
    const codes = new Set(ORIGINS.map((o) => o.code));
    for (const t of TARGETS) expect(codes.has(t.code)).toBe(true);
  });
  it('rejects bad coordinates', () => {
    expect(isValidCoord({ lat: 91, lon: 0 })).toBe(false);
    expect(isValidCoord({ lat: 0, lon: 181 })).toBe(false);
    expect(isValidCoord({ lat: NaN, lon: 0 })).toBe(false);
  });
  it('projects onto a sphere of the requested radius', () => {
    for (const p of ORIGINS) {
      const [x, y, z] = latLonToXYZ(p, 2);
      expect(Math.hypot(x, y, z)).toBeCloseTo(2, 10);
    }
    expect(latLonToXYZ({ lat: 90, lon: 0 })[1]).toBeCloseTo(1, 10);
  });
});

describe('formatting', () => {
  it('formats the clock and wraps at 24h', () => {
    expect(formatClock(14 * 3600 + 2 * 60 + 11)).toBe('14:02:11');
    expect(formatClock(86400 + 5)).toBe('00:00:05');
    expect(formatClock(-1)).toBe('23:59:59');
  });
  it('formats ticker lines in the documented shape', () => {
    const [e] = take(1, 1);
    expect(formatTickerLine(e!, 50531)).toMatch(
      /^14:02:11 · [a-z0-9-]+ · [A-Z]{3} → (blocked|contained|escalated) · \d+ms$/,
    );
  });
  it('sampleTicker is stable', () => {
    expect(sampleTicker(6)).toEqual(sampleTicker(6));
    expect(sampleTicker(6)).toHaveLength(6);
  });
});
