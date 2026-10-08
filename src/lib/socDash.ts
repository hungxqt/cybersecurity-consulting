import type { Outcome, ThreatEvent } from './threatSim';

export type AlertState = 'new' | 'triaging' | 'closed' | 'escalated';

/** Milliseconds an alert stays in each stage of the simulated triage. */
export const NEW_MS = 1000;
export const TRIAGE_MS = 2600;

/** State of an alert `ageMs` after it arrived. Escalated outcomes end in "escalated", the rest in "closed". */
export function stateAt(outcome: Outcome, ageMs: number): AlertState {
  if (ageMs < NEW_MS) return 'new';
  if (ageMs < TRIAGE_MS) return 'triaging';
  return outcome === 'escalated' ? 'escalated' : 'closed';
}

/** Simulated minutes until the attacker lost access. Deterministic from the event. */
export function containMinutes(e: Pick<ThreatEvent, 'outcome' | 'severity'>): number {
  if (e.outcome === 'blocked') return 0.1;
  if (e.outcome === 'contained') return 4 + e.severity;
  return 18 + 6 * e.severity;
}

export interface SocStats {
  total: number;
  escalated: number;
  /** Median time to detect, ms. */
  mttdMs: number;
  /** Average simulated time to contain, minutes. */
  mttrMin: number;
}

export function socStats(events: readonly ThreatEvent[]): SocStats {
  if (events.length === 0) return { total: 0, escalated: 0, mttdMs: 0, mttrMin: 0 };
  const lat = events.map((e) => e.latencyMs).sort((a, b) => a - b);
  const mid = Math.floor(lat.length / 2);
  const median = lat.length % 2 ? lat[mid]! : (lat[mid - 1]! + lat[mid]!) / 2;
  const mttr = events.reduce((s, e) => s + containMinutes(e), 0) / events.length;
  return {
    total: events.length,
    escalated: events.filter((e) => e.outcome === 'escalated').length,
    mttdMs: Math.round(median),
    mttrMin: Math.round(mttr * 10) / 10,
  };
}

export const SOURCES = ['EDR', 'IdP', 'Email gateway', 'WAF', 'Cloud trail', 'Firewall'] as const;

/** Stable pseudo-source for an event id, so the table does not change on re-render. */
export function sourceFor(id: number): string {
  return SOURCES[(id * 7 + 3) % SOURCES.length] as string;
}
