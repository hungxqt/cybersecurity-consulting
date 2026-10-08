/**
 * Deterministic, seeded simulation of attack telemetry. Pure TypeScript: no DOM, no network,
 * no Date.now(). The same seed always yields the same sequence, so it can be unit tested and
 * rendered at build time. Nothing here is real data.
 */
import type { LatLon } from './geo';

export interface Place extends LatLon {
  /** IATA-style code shown in the ticker. */
  code: string;
  name: string;
}

/** Cities used as attack origins. */
export const ORIGINS: readonly Place[] = [
  { code: 'SGN', name: 'Ho Chi Minh City', lat: 10.82, lon: 106.63 },
  { code: 'HAN', name: 'Hanoi', lat: 21.22, lon: 105.8 },
  { code: 'SIN', name: 'Singapore', lat: 1.36, lon: 103.99 },
  { code: 'HKG', name: 'Hong Kong', lat: 22.31, lon: 113.92 },
  { code: 'NRT', name: 'Tokyo', lat: 35.77, lon: 140.39 },
  { code: 'ICN', name: 'Seoul', lat: 37.46, lon: 126.44 },
  { code: 'BOM', name: 'Mumbai', lat: 19.09, lon: 72.87 },
  { code: 'DXB', name: 'Dubai', lat: 25.25, lon: 55.36 },
  { code: 'SVO', name: 'Moscow', lat: 55.97, lon: 37.41 },
  { code: 'FRA', name: 'Frankfurt', lat: 50.03, lon: 8.57 },
  { code: 'LHR', name: 'London', lat: 51.47, lon: -0.45 },
  { code: 'LOS', name: 'Lagos', lat: 6.58, lon: 3.32 },
  { code: 'JNB', name: 'Johannesburg', lat: -26.14, lon: 28.25 },
  { code: 'GRU', name: 'São Paulo', lat: -23.43, lon: -46.47 },
  { code: 'MEX', name: 'Mexico City', lat: 19.44, lon: -99.07 },
  { code: 'IAD', name: 'Washington', lat: 38.95, lon: -77.46 },
  { code: 'SFO', name: 'San Francisco', lat: 37.62, lon: -122.38 },
  { code: 'SYD', name: 'Sydney', lat: -33.95, lon: 151.18 },
];

/** Protected client sites: the shield is drawn around these. */
export const TARGETS: readonly Place[] = [
  { code: 'SGN', name: 'Ho Chi Minh City', lat: 10.82, lon: 106.63 },
  { code: 'HAN', name: 'Hanoi', lat: 21.22, lon: 105.8 },
  { code: 'SIN', name: 'Singapore', lat: 1.36, lon: 103.99 },
  { code: 'NRT', name: 'Tokyo', lat: 35.77, lon: 140.39 },
  { code: 'SYD', name: 'Sydney', lat: -33.95, lon: 151.18 },
  { code: 'FRA', name: 'Frankfurt', lat: 50.03, lon: 8.57 },
  { code: 'LHR', name: 'London', lat: 51.47, lon: -0.45 },
  { code: 'IAD', name: 'Washington', lat: 38.95, lon: -77.46 },
];

export const ATTACK_TYPES = [
  { id: 'credential-stuffing', weight: 22, severity: 2 },
  { id: 'ssh-bruteforce', weight: 18, severity: 1 },
  { id: 'phishing-kit', weight: 16, severity: 2 },
  { id: 'sql-injection', weight: 12, severity: 3 },
  { id: 'c2-beacon', weight: 10, severity: 3 },
  { id: 'ddos-syn-flood', weight: 8, severity: 2 },
  { id: 'ransomware-dropper', weight: 6, severity: 4 },
  { id: 'zero-day-probe', weight: 4, severity: 4 },
  { id: 'supply-chain', weight: 4, severity: 4 },
] as const;

export type AttackType = (typeof ATTACK_TYPES)[number]['id'];
export type Severity = 1 | 2 | 3 | 4;
export type Outcome = 'blocked' | 'contained' | 'escalated';

export interface ThreatEvent {
  /** 1-based position in the stream. */
  id: number;
  type: AttackType;
  severity: Severity;
  origin: Place;
  target: Place;
  outcome: Outcome;
  /** Time from first packet to the shield acting, in milliseconds. */
  latencyMs: number;
  /** Suggested wait before the next event, in milliseconds. */
  delayMs: number;
}

/** Share of events per outcome. Sums to 1. */
export const OUTCOME_RATES: Record<Outcome, number> = {
  blocked: 0.9,
  contained: 0.07,
  escalated: 0.03,
};

/** Small, fast, well-distributed seeded PRNG (mulberry32). Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted<T extends { weight: number }>(items: readonly T[], r: number): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let x = r * total;
  for (const item of items) {
    x -= item.weight;
    if (x < 0) return item;
  }
  return items[items.length - 1] as T;
}

function pickOutcome(r: number): Outcome {
  if (r < OUTCOME_RATES.blocked) return 'blocked';
  if (r < OUTCOME_RATES.blocked + OUTCOME_RATES.contained) return 'contained';
  return 'escalated';
}

const LATENCY_RANGE: Record<Outcome, [number, number]> = {
  blocked: [12, 90],
  contained: [90, 800],
  escalated: [800, 4000],
};

/** Create an endless, deterministic stream. Call next() for each new event. */
export function createThreatStream(seed: number): { next: () => ThreatEvent } {
  const rand = mulberry32(seed);
  let id = 0;
  return {
    next(): ThreatEvent {
      id += 1;
      const attack = pickWeighted(ATTACK_TYPES, rand());
      const target = TARGETS[Math.floor(rand() * TARGETS.length)] as Place;
      // Origin is drawn from every city except the target's own.
      const pool = ORIGINS.filter((o) => o.code !== target.code);
      const origin = pool[Math.floor(rand() * pool.length)] as Place;
      const outcome = pickOutcome(rand());
      const [lo, hi] = LATENCY_RANGE[outcome];
      const latencyMs = Math.round(lo + rand() * (hi - lo));
      // Bump severity by one for roughly 1 in 6 events, capped at 4.
      const bump = rand() < 1 / 6 ? 1 : 0;
      const severity = Math.min(4, attack.severity + bump) as Severity;
      const delayMs = Math.round(500 + rand() * 1500);
      return { id, type: attack.id, severity, origin, target, outcome, latencyMs, delayMs };
    },
  };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** HH:MM:SS from seconds since midnight (wraps at 24h). */
export function formatClock(secondsOfDay: number): string {
  const s = ((Math.floor(secondsOfDay) % 86400) + 86400) % 86400;
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** Ticker line, e.g. `14:02:11 · credential-stuffing · SGN → blocked · 38ms`. */
export function formatTickerLine(event: ThreatEvent, secondsOfDay: number): string {
  return `${formatClock(secondsOfDay)} · ${event.type} · ${event.origin.code} → ${event.outcome} · ${event.latencyMs}ms`;
}

/** Fixed sample for server-rendered output and reduced-motion users. */
export function sampleTicker(
  count = 6,
  seed = 20260914,
  startSeconds = 14 * 3600 + 2 * 60 + 11,
): string[] {
  const stream = createThreatStream(seed);
  const lines: string[] = [];
  let clock = startSeconds;
  for (let i = 0; i < count; i++) {
    const e = stream.next();
    lines.push(formatTickerLine(e, clock));
    clock += Math.max(1, Math.round(e.delayMs / 1000));
  }
  return lines;
}
