/**
 * Breach to Resilience: the two interactive journeys and their situation boards (design §6.3).
 * Pure TypeScript, no DOM and no i18n import: the Astro components, the client script and the
 * unit tests share one source of truth. Every playbook is generic: nothing here describes a client,
 * and no beat claims a performance figure.
 *
 * Clock strings use U+2212 (the real minus sign). `order` drives sorting; `clock` is display text.
 */
import { EDGES, type NexusEdge, type NodeId, type ServiceId } from './nexus';

export type { NodeId };

export interface BoardState {
  /** Token position; null = no attacker on the board. */
  attackerAt: NodeId | null;
  /** Flare ring on the mark (dashed in hypothetical mode). */
  compromised: NodeId[];
  /** Cyanotype tick, same Cyanotype tick as a contained system. */
  contained: NodeId[];
}

export interface Beat {
  id: string;
  /** Act id; its display name is `journey.<id>.act.<index + 1>`. */
  act: string;
  clock: string;
  order: number;
  /** Nodes named in this beat's text. */
  boardNodes: NodeId[];
  attackerKey: string;
  defenderKey: string;
  relatedService?: ServiceId;
  board: BoardState;
}

export interface DecisionOption {
  id: string;
  key: string;
  outcomeKey: string;
  recommended: boolean;
}

export interface Journey {
  id: string;
  services: ServiceId[];
  acts: string[];
  beats: Beat[];
  /** Exactly 8 nodes of the Nexus graph. */
  boardNodes: NodeId[];
  /** Mark centres in a 480×360 viewBox; keys are exactly the 8 `boardNodes`. */
  boardLayout: Record<string, { x: number; y: number }>;
  attackerMode: 'actual' | 'hypothetical';
  decision: { afterBeat: number; options: DecisionOption[] };
}

// --- Board geometry (viewBox units), shared by SituationBoard.astro and the tests ---------------

export const BOARD = {
  w: 480,
  h: 360,
  /** Column dividers between the four trust zones. */
  dividers: [120, 240, 360],
  /** Mono label: font size, gap under the mark, advance width and line height factors. */
  labelSize: 14.7,
  labelGap: 14,
  labelChar: 0.68,
  labelLine: 1.4,
  /** Compromised ring half-side. */
  ring: 10,
  /** Attacker token: side and offset from the mark centre. */
  token: { size: 7, dx: 18, dy: -8 },
  /** Contained tick: side and offset from the mark centre. */
  tick: { size: 5, dx: -15, dy: -8 },
  /** Characters per label line. */
  wrap: 8,
} as const;

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Greedy word wrap: words are never split, so a long word simply makes a long line. */
export function wrapLabel(text: string, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (!line) line = word;
    else if (line.length + 1 + word.length <= max) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Board label lines: EN is uppercased, VI stays sentence case. */
export function labelLines(text: string, lang: string): string[] {
  const shown = lang === 'vi' ? text : text.toLocaleUpperCase('en');
  return wrapLabel(shown, BOARD.wrap);
}

export function labelBox(c: { x: number; y: number }, lines: string[]): Box {
  const width = Math.max(...lines.map((l) => l.length)) * BOARD.labelChar * BOARD.labelSize;
  const height = lines.length * BOARD.labelSize * BOARD.labelLine;
  const top = c.y + BOARD.labelGap;
  return { x0: c.x - width / 2, x1: c.x + width / 2, y0: top, y1: top + height };
}

const sq = (c: { x: number; y: number }, half: number): Box => ({
  x0: c.x - half,
  y0: c.y - half,
  x1: c.x + half,
  y1: c.y + half,
});
export const ringBox = (c: { x: number; y: number }): Box => sq(c, BOARD.ring);
export const tokenBox = (c: { x: number; y: number }): Box =>
  sq({ x: c.x + BOARD.token.dx, y: c.y + BOARD.token.dy }, BOARD.token.size / 2);
export const tickBox = (c: { x: number; y: number }): Box =>
  sq({ x: c.x + BOARD.tick.dx, y: c.y + BOARD.tick.dy }, BOARD.tick.size / 2);

// --- Journeys -------------------------------------------------------------------------------

const M = '\u2212';

type Row = [
  clock: string,
  act: string,
  boardNodes: NodeId[],
  related: ServiceId,
  attackerAt: NodeId | null,
  compromised: NodeId[],
  contained: NodeId[],
];

function beatsOf(id: string, rows: Row[]): Beat[] {
  return rows.map(([clock, act, boardNodes, related, attackerAt, compromised, contained], i) => ({
    id: `beat-${i + 1}`,
    act,
    clock,
    order: i + 1,
    boardNodes,
    attackerKey: `journey.${id}.beat.${i + 1}.attacker`,
    defenderKey: `journey.${id}.beat.${i + 1}.defender`,
    relatedService: related,
    board: { attackerAt, compromised, contained },
  }));
}

function optionsOf(id: string, ids: string[], recommended: string): DecisionOption[] {
  return ids.map((o) => ({
    id: o,
    key: `journey.${id}.decision.${o}`,
    outcomeKey: `journey.${id}.decision.${o}.outcome`,
    recommended: o === recommended,
  }));
}

export const JOURNEYS: readonly Journey[] = [
  {
    id: 'vendor-account',
    services: ['soc', 'consulting'],
    acts: ['recon', 'intrusion', 'detection', 'recovery'],
    attackerMode: 'actual',
    boardNodes: ['stuffing', 'phish', 'vpn', 'idp', 'laptops', 'edr', 'siem', 'data'],
    boardLayout: {
      stuffing: { x: 60, y: 120 },
      phish: { x: 60, y: 192 },
      vpn: { x: 180, y: 120 },
      siem: { x: 300, y: 48 },
      idp: { x: 300, y: 120 },
      laptops: { x: 300, y: 192 },
      edr: { x: 300, y: 264 },
      data: { x: 420, y: 120 },
    },
    beats: beatsOf('vendor-account', [
      [`T${M}7d`, 'recon', ['phish', 'vpn'], 'consulting', 'phish', [], []],
      [`T${M}2d`, 'recon', ['stuffing', 'vpn'], 'soc', 'stuffing', [], []],
      ['T+00:00', 'intrusion', ['vpn', 'idp'], 'consulting', 'vpn', ['vpn', 'idp'], []],
      ['T+00:09', 'intrusion', ['idp', 'data'], 'soc', 'data', ['vpn', 'idp', 'data'], []],
      ['T+00:17', 'detection', ['idp', 'data'], 'soc', 'data', ['vpn', 'idp', 'data'], []],
      ['T+00:25', 'detection', ['vpn', 'idp', 'data'], 'soc', null, ['data'], ['vpn', 'idp']],
      ['T+04:00', 'recovery', ['idp', 'data'], 'consulting', null, [], ['vpn', 'idp', 'data']],
      ['T+3d', 'recovery', ['vpn', 'idp', 'data'], 'consulting', null, [], ['vpn', 'idp', 'data']],
    ]),
    decision: {
      afterBeat: 5,
      options: optionsOf('vendor-account', ['contain', 'observe', 'ask'], 'contain'),
    },
  },
  {
    id: 'before-launch',
    services: ['consulting', 'audit'],
    acts: ['design', 'threat-model', 'test', 'prove', 'launch'],
    attackerMode: 'hypothetical',
    boardNodes: ['recon', 'phish', 'webapp', 'idp', 'api', 'data', 'backups', 'siem'],
    boardLayout: {
      recon: { x: 60, y: 120 },
      phish: { x: 60, y: 264 },
      webapp: { x: 180, y: 120 },
      siem: { x: 300, y: 48 },
      idp: { x: 300, y: 192 },
      api: { x: 420, y: 120 },
      data: { x: 420, y: 192 },
      backups: { x: 420, y: 264 },
    },
    beats: beatsOf('before-launch', [
      [`L${M}10d`, 'design', ['recon', 'webapp'], 'consulting', 'recon', [], []],
      [`L${M}9d`, 'threat-model', ['phish', 'data'], 'consulting', 'phish', ['data'], []],
      [`L${M}6d`, 'test', ['api'], 'consulting', 'api', ['api'], ['data']],
      [`L${M}3d`, 'prove', ['idp'], 'audit', 'idp', ['idp'], ['data', 'api']],
      [`L${M}0`, 'launch', ['webapp', 'idp'], 'audit', 'webapp', [], ['data', 'api', 'idp']],
    ]),
    decision: {
      afterBeat: 2,
      options: optionsOf('before-launch', ['ship', 'slip', 'compensate'], 'compensate'),
    },
  },
];

export const JOURNEY_BY_ID: Readonly<Record<string, Journey>> = Object.fromEntries(
  JOURNEYS.map((j) => [j.id, j]),
);

/** True when `id` is one of the journey's decision options (a tampered DOM value is not). */
export function isOption(journey: Journey, id: unknown): boolean {
  return typeof id === 'string' && journey.decision.options.some((o) => o.id === id);
}

/** The act number (1-based) and key suffix a beat belongs to. */
export function actNumber(journey: Journey, beat: Beat): number {
  return journey.acts.indexOf(beat.act) + 1;
}

/** Edges drawn on a board: the Nexus edges whose two ends are both on it. */
export function boardEdges(journey: Journey): NexusEdge[] {
  const on = new Set<string>(journey.boardNodes);
  return EDGES.filter((e) => on.has(e.from) && on.has(e.to));
}
