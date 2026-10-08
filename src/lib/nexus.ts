/**
 * Cyber Intelligence Nexus: the data behind the home-page attack-path graph (design §6.1).
 * Pure TypeScript with no DOM and no i18n import, so the client script, the Astro component and
 * the unit tests share one source of truth. Everything here describes a simulated, generic
 * organisation, never a client.
 *
 * Coordinates are mark centres in viewBox units: `wide` is a 1000×600 box (≥ 720 px), `tall` a
 * 600×1200 box (< 720 px). Authored so tests/unit/nexus.test.ts (label-aware hit boxes at 557 px
 * wide and 324 px tall) passes; a label that breaks it is shortened in en.json, not squeezed.
 */
import { interpolate } from './interpolate';
import { createThreatStream, formatClock, type AttackType, type ThreatEvent } from './threatSim';

export type NodeKind = 'threat' | 'asset' | 'sensor';
export type ZoneId = 'internet' | 'perimeter' | 'corporate' | 'crown';
export type ServiceId = 'consulting' | 'audit' | 'soc';
export type Lens = 'all' | ServiceId;
export type Layout = 'wide' | 'tall';
export type EdgeKind = 'attack' | 'trust' | 'telemetry';
export type NodeId =
  | 'phish'
  | 'stuffing'
  | 'recon'
  | 'ransom'
  | 'mailgw'
  | 'vpn'
  | 'webapp'
  | 'edr'
  | 'laptops'
  | 'idp'
  | 'siem'
  | 'api'
  | 'data'
  | 'backups';

export interface Pt {
  x: number;
  y: number;
}

export interface NexusNode {
  id: NodeId;
  kind: NodeKind;
  zone: ZoneId;
  services: ServiceId[];
  /** Words other copy may use for this node (journey text is checked against them). */
  aliases: string[];
  wide: Pt;
  tall: Pt;
}

export interface NexusEdge {
  id: string;
  from: NodeId;
  to: NodeId;
  kind: EdgeKind;
}

export const VIEWBOX: Record<Layout, { w: number; h: number }> = {
  wide: { w: 1000, h: 600 },
  tall: { w: 600, h: 1200 },
};

/** Narrowest rendered stage per layout (px): cols 6–12 at 1080 px, and a 360 px viewport. */
export const MIN_STAGE_PX: Record<Layout, number> = { wide: 557, tall: 324 };

/** Height of a zone-label band in rendered px at the narrowest stage. */
export const BAND_PX = 28;

/** Obstacle clearance between a node hit box and a zone-label band (px). */
export const BAND_CLEARANCE_PX: Record<Layout, number> = {
  wide: 8,
  // The tall stage is a fixed 648 px at its narrowest: 4 bands + 8 two-line-worst-case rows + 7
  // 8 px gaps leave 3 px per band. A band is 28 px of which the label uses 17.
  tall: 2,
};

/**
 * 8 px inline padding + 5 px half-mark: shifting the button left by this lands the mark centre
 * on the node coordinate. NexusGraph.astro (`translate: -13px -50%`) and the spacing test use it.
 */
export const NODE_ANCHOR_PX = 13;

/** Only the crown zone in the wide layout is mirrored: label left of the mark. */
export function isMirrored(node: Pick<NexusNode, 'zone'>, layout: Layout): boolean {
  return node.zone === 'crown' && layout === 'wide';
}

// NODES are listed in the wide reading order (zones left to right, top to bottom).
export const NODES: readonly NexusNode[] = [
  {
    id: 'phish',
    kind: 'threat',
    zone: 'internet',
    services: ['consulting', 'soc'],
    aliases: ['phishing', 'forwarded email'],
    wide: { x: 30.5, y: 122.1 },
    tall: { x: 24.1, y: 110.5 },
  },
  {
    id: 'stuffing',
    kind: 'threat',
    zone: 'internet',
    services: ['consulting', 'soc'],
    aliases: [],
    wide: { x: 30.5, y: 258.5 },
    tall: { x: 279.6, y: 110.5 },
  },
  {
    id: 'recon',
    kind: 'threat',
    zone: 'internet',
    services: ['consulting'],
    aliases: ['exposes'],
    wide: { x: 30.5, y: 395 },
    tall: { x: 98.1, y: 234 },
  },
  {
    id: 'ransom',
    kind: 'threat',
    zone: 'internet',
    services: ['consulting', 'soc'],
    aliases: [],
    wide: { x: 30.5, y: 531.4 },
    tall: { x: 353.7, y: 234 },
  },
  {
    id: 'mailgw',
    kind: 'sensor',
    zone: 'perimeter',
    services: ['soc'],
    aliases: [],
    wide: { x: 278.3, y: 122.1 },
    tall: { x: 68.5, y: 413 },
  },
  {
    id: 'vpn',
    kind: 'asset',
    zone: 'perimeter',
    services: ['consulting', 'audit', 'soc'],
    aliases: ['remote access', 'portal'],
    wide: { x: 278.3, y: 258.5 },
    tall: { x: 324.1, y: 413 },
  },
  {
    id: 'webapp',
    kind: 'asset',
    zone: 'perimeter',
    services: ['consulting', 'soc'],
    aliases: ['portal', 'web app'],
    wide: { x: 278.3, y: 395 },
    tall: { x: 24.1, y: 536.5 },
  },
  {
    id: 'edr',
    kind: 'sensor',
    zone: 'corporate',
    services: ['soc'],
    aliases: [],
    wide: { x: 526, y: 122.1 },
    tall: { x: 98.1, y: 716.7 },
  },
  {
    id: 'laptops',
    kind: 'asset',
    zone: 'corporate',
    services: ['audit', 'soc'],
    aliases: [],
    wide: { x: 526, y: 258.5 },
    tall: { x: 353.7, y: 716.7 },
  },
  {
    id: 'idp',
    kind: 'asset',
    zone: 'corporate',
    services: ['consulting', 'audit', 'soc'],
    aliases: ['MFA', 'admin account', 'vendor account'],
    wide: { x: 526, y: 395 },
    tall: { x: 53.7, y: 840.2 },
  },
  {
    id: 'siem',
    kind: 'sensor',
    zone: 'corporate',
    services: ['soc'],
    aliases: [],
    wide: { x: 526, y: 531.4 },
    tall: { x: 309.3, y: 840.2 },
  },
  {
    id: 'api',
    kind: 'asset',
    zone: 'crown',
    services: ['consulting', 'audit'],
    aliases: ['API'],
    wide: { x: 960.5, y: 258.5 },
    tall: { x: 24.1, y: 1020.4 },
  },
  {
    id: 'data',
    kind: 'asset',
    zone: 'crown',
    services: ['consulting', 'audit'],
    aliases: ['customer data', 'customer files', 'export folder'],
    wide: { x: 960.5, y: 395 },
    tall: { x: 279.6, y: 1020.4 },
  },
  {
    id: 'backups',
    kind: 'asset',
    zone: 'crown',
    services: ['audit', 'soc'],
    aliases: [],
    wide: { x: 960.5, y: 531.4 },
    tall: { x: 98.1, y: 1143.9 },
  },
];

export const EDGES: readonly NexusEdge[] = [
  { id: 'a1', from: 'phish', to: 'laptops', kind: 'attack' },
  { id: 'a2', from: 'stuffing', to: 'vpn', kind: 'attack' },
  { id: 'a3', from: 'stuffing', to: 'webapp', kind: 'attack' },
  { id: 'a4', from: 'recon', to: 'webapp', kind: 'attack' },
  { id: 'a5', from: 'recon', to: 'vpn', kind: 'attack' },
  { id: 'a6', from: 'ransom', to: 'vpn', kind: 'attack' },
  { id: 't1', from: 'vpn', to: 'idp', kind: 'trust' },
  { id: 't2', from: 'laptops', to: 'idp', kind: 'trust' },
  { id: 't3', from: 'idp', to: 'api', kind: 'trust' },
  { id: 't4', from: 'idp', to: 'data', kind: 'trust' },
  { id: 't5', from: 'webapp', to: 'api', kind: 'trust' },
  { id: 't6', from: 'api', to: 'data', kind: 'trust' },
  { id: 't7', from: 'data', to: 'backups', kind: 'trust' },
  { id: 'm1', from: 'laptops', to: 'edr', kind: 'telemetry' },
  { id: 'm2', from: 'laptops', to: 'mailgw', kind: 'telemetry' },
  { id: 'm3', from: 'idp', to: 'siem', kind: 'telemetry' },
  { id: 'm4', from: 'vpn', to: 'siem', kind: 'telemetry' },
  { id: 'm5', from: 'webapp', to: 'siem', kind: 'telemetry' },
  { id: 'm6', from: 'api', to: 'siem', kind: 'telemetry' },
  { id: 'm7', from: 'backups', to: 'siem', kind: 'telemetry' },
];

export interface Zone {
  id: ZoneId;
  /** Wide layout: column bounds (viewBox x). */
  wide: { x0: number; x1: number };
  /** Tall layout: row bounds (viewBox y). The label band is the first band units of the row. */
  tall: { y0: number; y1: number };
}

export const ZONES: readonly Zone[] = [
  { id: 'internet', wide: { x0: 0, x1: 247.8 }, tall: { y0: 0, y1: 302.6 } },
  { id: 'perimeter', wide: { x0: 247.8, x1: 495.7 }, tall: { y0: 302.6, y1: 605.2 } },
  { id: 'corporate', wide: { x0: 495.7, x1: 743.3 }, tall: { y0: 605.2, y1: 907.8 } },
  { id: 'crown', wide: { x0: 743.3, x1: 1000 }, tall: { y0: 907.8, y1: 1200 } },
];

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Zone-label band height in viewBox units at the narrowest stage of the layout. */
export function bandUnits(layout: Layout): number {
  return (BAND_PX * VIEWBOX[layout].w) / MIN_STAGE_PX[layout];
}

/** Obstacle rectangles for the zone labels (viewBox units): one band (wide) or one per zone. */
export function bandRects(layout: Layout): Rect[] {
  const h = bandUnits(layout);
  const { w } = VIEWBOX[layout];
  if (layout === 'wide') return [{ x0: 0, y0: 0, x1: w, y1: h }];
  return ZONES.map((z) => ({ x0: 0, y0: z.tall.y0, x1: w, y1: z.tall.y0 + h }));
}

export const NODE_BY_ID: Readonly<Record<NodeId, NexusNode>> = Object.fromEntries(
  NODES.map((n) => [n.id, n]),
) as Record<NodeId, NexusNode>;

export function isNodeId(value: unknown): value is NodeId {
  return typeof value === 'string' && value in NODE_BY_ID;
}

/** Ids of systems directly linked to `id` by any edge, in either direction. */
export function neighbours(id: NodeId): NodeId[] {
  const out = new Set<NodeId>();
  for (const e of EDGES) {
    if (e.from === id) out.add(e.to);
    else if (e.to === id) out.add(e.from);
  }
  return [...out];
}

export function adjacency(): Record<NodeId, NodeId[]> {
  return Object.fromEntries(NODES.map((n) => [n.id, neighbours(n.id)])) as Record<NodeId, NodeId[]>;
}

/** Zones left to right (wide) or top to bottom (tall), then top to bottom, then left to right. */
export function readingOrder(layout: Layout): NodeId[] {
  const zoneIndex = (z: ZoneId) => ZONES.findIndex((zone) => zone.id === z);
  return [...NODES]
    .sort((a, b) => {
      const dz = zoneIndex(a.zone) - zoneIndex(b.zone);
      if (dz !== 0) return dz;
      const pa = a[layout];
      const pb = b[layout];
      return pa.y - pb.y || pa.x - pb.x;
    })
    .map((n) => n.id);
}

export type Dir = 'left' | 'right' | 'up' | 'down';

/**
 * Nearest node inside the 90° cone around `dir`. Ties break on the smaller angle from the
 * direction axis, then on reading order. Null when nothing lies in the cone.
 */
export function spatialNext(id: NodeId, dir: Dir, layout: Layout): NodeId | null {
  const from = NODE_BY_ID[id]?.[layout];
  if (!from) return null;
  const order = readingOrder(layout);
  let best: { id: NodeId; dist: number; angle: number; rank: number } | null = null;
  for (const n of NODES) {
    if (n.id === id) continue;
    const dx = n[layout].x - from.x;
    const dy = n[layout].y - from.y;
    const along = dir === 'right' ? dx : dir === 'left' ? -dx : dir === 'down' ? dy : -dy;
    const across = dir === 'left' || dir === 'right' ? dy : dx;
    if (along <= 0 || Math.abs(across) > along) continue;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(Math.abs(across), along);
    const rank = order.indexOf(n.id);
    const better =
      best === null ||
      dist < best.dist - 1e-9 ||
      (Math.abs(dist - best.dist) <= 1e-9 &&
        (angle < best.angle - 1e-9 || (Math.abs(angle - best.angle) <= 1e-9 && rank < best.rank)));
    if (better) best = { id: n.id, dist, angle, rank };
  }
  return best ? best.id : null;
}

/** Nodes a lens keeps in focus ('all' keeps everything). */
export function nodesForLens(lens: Lens): NodeId[] {
  if (lens === 'all') return NODES.map((n) => n.id);
  return NODES.filter((n) => n.services.includes(lens)).map((n) => n.id);
}

// --- Ambient simulation ---------------------------------------------------------------------

/** The only attack types with a natural path through this graph. */
export const AMBIENT_TYPES = [
  'credential-stuffing',
  'ssh-bruteforce',
  'phishing-kit',
  'sql-injection',
  'ransomware-dropper',
  'zero-day-probe',
] as const satisfies readonly AttackType[];

export type AmbientType = (typeof AMBIENT_TYPES)[number];

const EVENT_EDGE: Record<AmbientType, string> = {
  'credential-stuffing': 'a3',
  'ssh-bruteforce': 'a5',
  'phishing-kit': 'a1',
  'sql-injection': 'a4',
  'ransomware-dropper': 'a6',
  'zero-day-probe': 'a4',
};

function isAmbient(type: string): type is AmbientType {
  return (AMBIENT_TYPES as readonly string[]).includes(type);
}

/** Attack edge an event type travels, or null when it has no natural path here. */
export function eventToEdge(type: string): string | null {
  return isAmbient(type) ? EVENT_EDGE[type] : null;
}

/** Deterministic stream of threatSim events, skipping types that have no edge. */
export function nexusAmbient(seed: number): { next: () => ThreatEvent } {
  const stream = createThreatStream(seed);
  return {
    next(): ThreatEvent {
      for (let i = 0; i < 1000; i++) {
        const e = stream.next();
        if (eventToEdge(e.type) !== null) return e;
      }
      throw new Error('nexusAmbient: no mapped event in 1000 draws');
    },
  };
}

/** Two fixed rows per event, so no log line ever wraps: `14:02:11 · phishing-kit`, `SGN › blocked · 38ms`. */
export function formatAmbientRows(event: ThreatEvent, secondsOfDay: number): [string, string] {
  return [
    `${formatClock(secondsOfDay)} · ${event.type}`,
    `${event.origin.code} \u203A ${event.outcome} · ${event.latencyMs}ms`,
  ];
}

/** Fixed sample for the server-rendered and reduced-motion log. */
export function sampleAmbient(
  count = 3,
  seed = 20260914,
  startSeconds = 14 * 3600 + 2 * 60 + 11,
): [string, string][] {
  const stream = nexusAmbient(seed);
  const rows: [string, string][] = [];
  let clock = startSeconds;
  for (let i = 0; i < count; i++) {
    const e = stream.next();
    rows.push(formatAmbientRows(e, clock));
    clock += Math.max(1, Math.round(e.delayMs / 1000));
  }
  return rows;
}

// --- Relationships and copy -----------------------------------------------------------------

export interface Relations {
  reachedFrom: NodeId[];
  leadsTo: NodeId[];
  watchedBy: NodeId[];
}

/**
 * What reaches a system, what it leads to and who watches it, in EDGES order. A sensor's
 * "reached from" lists the systems that send it signals.
 */
export function relations(id: NodeId): Relations {
  const reachedFrom: NodeId[] = [];
  const leadsTo: NodeId[] = [];
  const watchedBy: NodeId[] = [];
  const isSensor = NODE_BY_ID[id].kind === 'sensor';
  for (const e of EDGES) {
    if (e.to === id && (e.kind !== 'telemetry' || isSensor)) reachedFrom.push(e.from);
    if (e.from === id) {
      if (e.kind === 'telemetry') watchedBy.push(e.to);
      else leadsTo.push(e.to);
    }
  }
  return { reachedFrom, leadsTo, watchedBy };
}

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export const SERVICES: readonly ServiceId[] = ['consulting', 'audit', 'soc'];

/**
 * The sentence a node's aria-describedby points at, e.g. "Asset, corporate zone. Reached from …".
 * `t` is passed in so this module never imports the dictionaries; call it at build time only.
 */
export function describeNode(id: NodeId, t: Translate, lang: string): string {
  const node = NODE_BY_ID[id];
  const list = (ids: readonly string[]) =>
    new Intl.ListFormat(lang, { style: 'long', type: 'conjunction' }).format(ids);
  const names = (ids: readonly NodeId[]) => list(ids.map((n) => t(`nexus.node.${n}.label`)));
  const rel = relations(id);
  const parts = [
    interpolate(t('nexus.sr.kindZone'), {
      kind: t(`nexus.legend.${node.kind}`),
      zone: t(`nexus.zone.${node.zone}`),
    }),
  ];
  if (rel.reachedFrom.length)
    parts.push(interpolate(t('nexus.sr.reachedFrom'), { list: names(rel.reachedFrom) }));
  if (rel.leadsTo.length)
    parts.push(interpolate(t('nexus.sr.leadsTo'), { list: names(rel.leadsTo) }));
  if (rel.watchedBy.length)
    parts.push(interpolate(t('nexus.sr.watchedBy'), { list: names(rel.watchedBy) }));
  if (node.services.length)
    parts.push(
      interpolate(t('nexus.sr.coveredBy'), {
        list: list(node.services.map((s) => t(`nexus.lens.${s}`))),
      }),
    );
  return parts.join(' ');
}
