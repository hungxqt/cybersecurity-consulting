import { describe, expect, it } from 'vitest';
import en from '../../src/i18n/en.json';
import vi from '../../src/i18n/vi.json';
import {
  AMBIENT_TYPES,
  BAND_CLEARANCE_PX,
  EDGES,
  MIN_STAGE_PX,
  NODES,
  NODE_ANCHOR_PX,
  NODE_BY_ID,
  VIEWBOX,
  ZONES,
  adjacency,
  bandRects,
  describeNode,
  eventToEdge,
  formatAmbientRows,
  isMirrored,
  neighbours,
  nexusAmbient,
  nodesForLens,
  readingOrder,
  relations,
  sampleAmbient,
  spatialNext,
  type Layout,
  type NexusNode,
  type NodeId,
  type Rect,
} from '../../src/lib/nexus';
import { ATTACK_TYPES, ORIGINS, type Outcome, type ThreatEvent } from '../../src/lib/threatSim';
import { interpolate } from '../../src/lib/interpolate';

const EN = en as Record<string, string>;
const VI = vi as Record<string, string>;
const PLACEHOLDER = '[VI] ';

// --- helpers mirroring design §6.1 -----------------------------------------------------------

/** Greedy word-wrap at `max` characters; a word longer than `max` is broken. */
function wrap(text: string, max = 12): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    let w = word;
    while (w.length > max) {
      if (line) {
        lines.push(line);
        line = '';
      }
      lines.push(w.slice(0, max));
      w = w.slice(max);
    }
    if (!line) line = w;
    else if (line.length + 1 + w.length <= max) line += ` ${w}`;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

interface Box {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

type LabelLang = 'en' | 'vi';

/** Estimated label box (px) per the §6.1 formula. */
function boxSize(label: string, lang: LabelLang): { w: number; h: number } {
  if (lang === 'en') {
    const lines = wrap(label.toUpperCase());
    const cpl = Math.max(...lines.map((l) => l.length));
    return {
      w: 10 + 6 + Math.min(cpl, 12) * 0.68 * 12 + 16,
      h: Math.max(44, lines.length * 12 * 1.4 + 8),
    };
  }
  // VI: the "[VI] " placeholder plus a 30 % allowance for real translations; worst case 3 lines.
  const lines = wrap(`${PLACEHOLDER}${label}`);
  const cpl = Math.ceil(Math.max(...lines.map((l) => l.length)) * 1.3);
  return { w: 10 + 6 + Math.min(cpl, 12) * 0.68 * 12 + 16, h: Math.max(44, 3 * 12 * 1.4 + 8) };
}

function boxes(layout: Layout, lang: LabelLang): Box[] {
  const stage = MIN_STAGE_PX[layout];
  const scale = stage / VIEWBOX[layout].w;
  return NODES.map((n: NexusNode) => {
    const { w, h } = boxSize(EN[`nexus.node.${n.id}.label`]!, lang);
    const cx = n[layout].x * scale;
    const cy = n[layout].y * scale;
    const x0 = isMirrored(n, layout) ? cx + NODE_ANCHOR_PX - w : cx - NODE_ANCHOR_PX;
    return { id: n.id, x0, y0: cy - h / 2, x1: x0 + w, y1: cy + h / 2 };
  });
}

function distance(a: Rect | Box, b: Rect | Box): number {
  const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1);
  const dy = Math.max(0, a.y0 - b.y1, b.y0 - a.y1);
  return Math.hypot(dx, dy);
}

function overlaps(a: Rect | Box, b: Rect | Box): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

function bandsPx(layout: Layout): Rect[] {
  const scale = MIN_STAGE_PX[layout] / VIEWBOX[layout].w;
  return bandRects(layout).map((r) => ({
    x0: r.x0 * scale,
    y0: r.y0 * scale,
    x1: r.x1 * scale,
    y1: r.y1 * scale,
  }));
}

// --- graph shape -----------------------------------------------------------------------------

describe('graph data', () => {
  it('has the 14 nodes and 20 edges of the design', () => {
    expect(NODES).toHaveLength(14);
    expect(new Set(NODES.map((n) => n.id)).size).toBe(14);
    expect(EDGES).toHaveLength(20);
    expect(new Set(EDGES.map((e) => e.id)).size).toBe(20);
    expect(EDGES.map((e) => e.id)).toEqual([
      ...['a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
      ...['t1', 't2', 't3', 't4', 't5', 't6', 't7'],
      ...['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'],
    ]);
    expect(EDGES.filter((e) => e.kind === 'attack')).toHaveLength(6);
    expect(EDGES.filter((e) => e.kind === 'trust')).toHaveLength(7);
    expect(EDGES.filter((e) => e.kind === 'telemetry')).toHaveLength(7);
  });

  it('edge endpoints exist and have the right kinds', () => {
    for (const e of EDGES) {
      expect(NODE_BY_ID[e.from], e.id).toBeDefined();
      expect(NODE_BY_ID[e.to], e.id).toBeDefined();
      if (e.kind === 'attack') {
        expect(NODE_BY_ID[e.from].kind).toBe('threat');
        expect(NODE_BY_ID[e.to].kind).toBe('asset');
      }
      if (e.kind === 'telemetry') expect(NODE_BY_ID[e.to].kind).toBe('sensor');
    }
  });

  it('orders zones internet → perimeter → corporate → crown in both layouts', () => {
    expect(ZONES.map((z) => z.id)).toEqual(['internet', 'perimeter', 'corporate', 'crown']);
    for (let i = 1; i < ZONES.length; i++) {
      expect(ZONES[i]!.wide.x0).toBeCloseTo(ZONES[i - 1]!.wide.x1, 5);
      expect(ZONES[i]!.tall.y0).toBeCloseTo(ZONES[i - 1]!.tall.y1, 5);
    }
    expect(ZONES[0]!.wide.x0).toBe(0);
    expect(ZONES[3]!.wide.x1).toBe(1000);
    expect(ZONES[0]!.tall.y0).toBe(0);
    expect(ZONES[3]!.tall.y1).toBe(1200);
    for (const layout of ['wide', 'tall'] as const) {
      for (const n of NODES) {
        const z = ZONES.find((zone) => zone.id === n.zone)!;
        if (layout === 'wide') {
          expect(n.wide.x).toBeGreaterThanOrEqual(z.wide.x0);
          expect(n.wide.x).toBeLessThan(z.wide.x1);
        } else {
          expect(n.tall.y).toBeGreaterThan(z.tall.y0);
          expect(n.tall.y).toBeLessThan(z.tall.y1);
        }
      }
    }
  });

  it('lets every threat reach a crown-zone asset along attack and trust edges', () => {
    for (const threat of NODES.filter((n) => n.kind === 'threat')) {
      const seen = new Set<NodeId>([threat.id]);
      const queue: NodeId[] = [threat.id];
      while (queue.length) {
        const cur = queue.shift()!;
        for (const e of EDGES) {
          if (e.from === cur && e.kind !== 'telemetry' && !seen.has(e.to)) {
            seen.add(e.to);
            queue.push(e.to);
          }
        }
      }
      expect(
        [...seen].some((id) => NODE_BY_ID[id].zone === 'crown'),
        threat.id,
      ).toBe(true);
    }
  });

  it('watches the target of every attack edge', () => {
    for (const e of EDGES.filter((x) => x.kind === 'attack')) {
      expect(
        EDGES.some((m) => m.kind === 'telemetry' && m.from === e.to),
        e.id,
      ).toBe(true);
    }
  });

  it('gives every node an edge and at least one service', () => {
    for (const n of NODES) {
      expect(neighbours(n.id).length, n.id).toBeGreaterThan(0);
      expect(n.services.length, n.id).toBeGreaterThan(0);
    }
    expect(NODE_BY_ID.vpn.services).toEqual(['consulting', 'audit', 'soc']);
    expect(NODE_BY_ID.edr.services).toEqual(['soc']);
    expect(NODE_BY_ID.idp.aliases).toEqual(['MFA', 'admin account', 'vendor account']);
    expect(NODE_BY_ID.data.aliases).toEqual(['customer data', 'customer files', 'export folder']);
  });

  it('keeps adjacency symmetric', () => {
    const adj = adjacency();
    for (const [id, list] of Object.entries(adj))
      for (const other of list) expect(adj[other as NodeId]).toContain(id);
  });

  it('computes relations from the edge table', () => {
    expect(relations('idp').reachedFrom).toEqual(['vpn', 'laptops']);
    expect(relations('idp').leadsTo).toEqual(['api', 'data']);
    expect(relations('idp').watchedBy).toEqual(['siem']);
    expect(relations('phish').leadsTo).toEqual(['laptops']);
    expect(relations('siem').reachedFrom).toEqual(['idp', 'vpn', 'webapp', 'api', 'backups']);
  });

  it('filters by lens', () => {
    expect(nodesForLens('all')).toHaveLength(14);
    expect(nodesForLens('soc')).toContain('siem');
    expect(nodesForLens('audit')).not.toContain('edr');
  });
});

describe('spatialNext and reading order', () => {
  it('lists nodes in the NODES order for the wide layout', () => {
    expect(readingOrder('wide')).toEqual(NODES.map((n) => n.id));
    expect(readingOrder('tall')).toHaveLength(14);
  });

  it('is deterministic and respects the 90° cone', () => {
    expect(spatialNext('idp', 'right', 'wide')).toBe('data');
    expect(spatialNext('idp', 'right', 'wide')).toBe(spatialNext('idp', 'right', 'wide'));
    expect(spatialNext('edr', 'down', 'wide')).toBe('laptops');
    expect(spatialNext('laptops', 'up', 'wide')).toBe('edr');
    expect(spatialNext('phish', 'left', 'wide')).toBeNull();
    expect(spatialNext('phish', 'up', 'wide')).toBeNull();
    expect(spatialNext('backups', 'right', 'wide')).toBeNull();
    expect(spatialNext('phish', 'down', 'tall')).toBe('recon');
    expect(spatialNext('phish', 'right', 'tall')).toBe('stuffing');
  });

  it('can move from every node to somewhere, in at least one direction', () => {
    for (const layout of ['wide', 'tall'] as const)
      for (const n of NODES) {
        const moves = (['left', 'right', 'up', 'down'] as const).map((d) =>
          spatialNext(n.id, d, layout),
        );
        expect(
          moves.some((m) => m !== null),
          `${layout}:${n.id}`,
        ).toBe(true);
      }
  });
});

// --- spacing ---------------------------------------------------------------------------------

describe('label-aware hit boxes', () => {
  const cases: [Layout, LabelLang][] = [
    ['wide', 'en'],
    ['wide', 'vi'],
    ['tall', 'en'],
    ['tall', 'vi'],
  ];
  for (const [layout, lang] of cases) {
    it(`fit the ${layout} stage (${MIN_STAGE_PX[layout]} px) in ${lang}`, () => {
      const all = boxes(layout, lang);
      const stageW = MIN_STAGE_PX[layout];
      const stageH = (stageW * VIEWBOX[layout].h) / VIEWBOX[layout].w;
      for (const b of all) {
        expect(b.x0, `${b.id} x0`).toBeGreaterThanOrEqual(0);
        expect(b.y0, `${b.id} y0`).toBeGreaterThanOrEqual(0);
        expect(b.x1, `${b.id} x1`).toBeLessThanOrEqual(stageW);
        expect(b.y1, `${b.id} y1`).toBeLessThanOrEqual(stageH);
      }
      for (let i = 0; i < all.length; i++)
        for (let j = i + 1; j < all.length; j++) {
          const d = distance(all[i]!, all[j]!);
          expect(d, `${all[i]!.id} / ${all[j]!.id}`).toBeGreaterThanOrEqual(8);
        }
      const clearance = BAND_CLEARANCE_PX[layout];
      for (const b of all)
        for (const band of bandsPx(layout)) {
          expect(overlaps(b, band), `${b.id} overlaps a band`).toBe(false);
          expect(distance(b, band), `${b.id} / band`).toBeGreaterThanOrEqual(clearance);
        }
    });
  }

  it('keeps zone labels on one line inside their zone', () => {
    // JetBrains Mono advances 0.6 em; EN is uppercase with 0.08 em tracking, VI sentence case 0.02 em.
    const advance = (tracking: number) => 12 * (0.6 + tracking);
    const pitch =
      (MIN_STAGE_PX.wide * (ZONES[0]!.wide.x1 - ZONES[0]!.wide.x0)) / VIEWBOX.wide.w - 8;
    for (const z of ZONES) {
      const label = EN[`nexus.zone.${z.id}`]!;
      expect(label.length, z.id).toBeLessThanOrEqual(14);
      const zoneW = ((z.wide.x1 - z.wide.x0) * MIN_STAGE_PX.wide) / VIEWBOX.wide.w;
      expect(label.length * advance(0.08), `${z.id} en`).toBeLessThanOrEqual(zoneW - 4);
      // VI: the placeholder, and a +30 % allowance for a real translation.
      expect(
        (PLACEHOLDER + label).length * advance(0.02),
        `${z.id} vi placeholder`,
      ).toBeLessThanOrEqual(zoneW - 4);
      expect(Math.ceil(label.length * 1.3) * advance(0.02), `${z.id} vi +30%`).toBeLessThanOrEqual(
        zoneW - 4,
      );
      // Tall: the band spans the full 324 px.
      expect((PLACEHOLDER + label).length * advance(0.02)).toBeLessThanOrEqual(MIN_STAGE_PX.tall);
    }
    expect(pitch).toBeGreaterThan(100);
  });

  it('wraps EN labels to at most two lines at 12 characters', () => {
    for (const n of NODES) {
      const label = EN[`nexus.node.${n.id}.label`]!;
      expect(wrap(label.toUpperCase()).length, n.id).toBeLessThanOrEqual(2);
    }
  });
});

// --- copy ------------------------------------------------------------------------------------

describe('copy', () => {
  const keys = [
    'hero.title.dim',
    'hero.title.strong',
    'hero.cta.solutions',
    'nexus.groupLabel',
    'nexus.help',
    'nexus.logLabel',
    'nexus.pause',
    'nexus.resume',
    'nexus.tableSummary',
    'nexus.table.caption',
    'nexus.table.system',
    'nexus.table.kind',
    'nexus.table.zone',
    ...['legend', 'all', 'consulting', 'audit', 'soc'].map((k) => `nexus.lens.${k}`),
    ...['internet', 'perimeter', 'corporate', 'crown'].map((k) => `nexus.zone.${k}`),
    ...['label', 'title', 'body'].map((k) => `nexus.intro.${k}`),
    ...['threat', 'asset', 'sensor', 'attack', 'trust'].map((k) => `nexus.legend.${k}`),
    ...['reachedFrom', 'leadsTo', 'watchedBy', 'coveredBy', 'none'].map((k) => `nexus.card.${k}`),
    ...['kindZone', 'reachedFrom', 'leadsTo', 'watchedBy', 'coveredBy'].map((k) => `nexus.sr.${k}`),
    ...NODES.flatMap((n) => [`nexus.node.${n.id}.label`, `nexus.node.${n.id}.desc`]),
  ];

  it('defines every referenced key in en.json and vi.json', () => {
    for (const k of keys) {
      expect(EN[k], k).toBeTruthy();
      expect(VI[k], k).toBeTruthy();
    }
  });

  it('keeps node and intro descriptions within 120 characters', () => {
    const descKeys = [...NODES.map((n) => `nexus.node.${n.id}.desc`), 'nexus.intro.body'];
    for (const k of descKeys) {
      expect(EN[k]!.length, k).toBeLessThanOrEqual(120);
      const v = VI[k]!;
      if (!v.startsWith(PLACEHOLDER)) expect(v.length, `${k} (vi)`).toBeLessThanOrEqual(120);
      else expect(v).toBe(PLACEHOLDER + EN[k]);
    }
  });

  it('makes no performance claims in node descriptions', () => {
    for (const n of NODES)
      expect(EN[`nexus.node.${n.id}.desc`]).not.toMatch(
        /\b\d+\s*(%|ms|min|minutes|hours?)\b|within minutes/i,
      );
  });

  it('describes a node as one sentence list for aria-describedby', () => {
    const t = (key: string, vars?: Record<string, string | number>) =>
      interpolate(EN[key] ?? key, vars);
    expect(describeNode('idp', t, 'en')).toBe(
      'Asset, Corporate zone. Reached from Remote access and Staff laptops. ' +
        'Leads to Payment API and Customer database. Watched by SOC / SIEM. ' +
        'Covered by Consulting, Audit, and SOC.',
    );
    expect(describeNode('phish', t, 'en')).toBe(
      'Threat, Internet zone. Leads to Staff laptops. Covered by Consulting and SOC.',
    );
  });
});

// --- ambient ---------------------------------------------------------------------------------

describe('ambient events', () => {
  it('maps exactly the six ambient types to an attack edge', () => {
    expect([...AMBIENT_TYPES]).toEqual([
      'credential-stuffing',
      'ssh-bruteforce',
      'phishing-kit',
      'sql-injection',
      'ransomware-dropper',
      'zero-day-probe',
    ]);
    const mapped = ATTACK_TYPES.filter((a) => eventToEdge(a.id) !== null).map((a) => a.id);
    expect(mapped.sort()).toEqual([...AMBIENT_TYPES].sort());
    for (const type of AMBIENT_TYPES) {
      const edge = EDGES.find((e) => e.id === eventToEdge(type));
      expect(edge?.kind, type).toBe('attack');
    }
    expect(eventToEdge('c2-beacon')).toBeNull();
    expect(eventToEdge('ddos-syn-flood')).toBeNull();
    expect(eventToEdge('supply-chain')).toBeNull();
    expect(eventToEdge('credential-stuffing')).toBe('a3');
    expect(eventToEdge('ssh-bruteforce')).toBe('a5');
    expect(eventToEdge('phishing-kit')).toBe('a1');
    expect(eventToEdge('sql-injection')).toBe('a4');
    expect(eventToEdge('ransomware-dropper')).toBe('a6');
    expect(eventToEdge('zero-day-probe')).toBe('a4');
  });

  it('never yields an unmapped type, and is deterministic', () => {
    const a = nexusAmbient(7);
    const b = nexusAmbient(7);
    for (let i = 0; i < 400; i++) {
      const ea = a.next();
      expect(eventToEdge(ea.type), ea.type).not.toBeNull();
      expect(b.next()).toEqual(ea);
    }
    expect(sampleAmbient(3)).toEqual(sampleAmbient(3));
    expect(sampleAmbient(3)).toHaveLength(3);
  });

  it('formats two short rows that match the e2e patterns', () => {
    const row1 = /^\d{2}:\d{2}:\d{2} · [a-z0-9-]+$/;
    const row2 = /^[A-Z]{3} \u203A (blocked|contained|escalated) · \d+ms$/;
    const outcomes: Outcome[] = ['blocked', 'contained', 'escalated'];
    const maxLatency: Record<Outcome, number> = { blocked: 90, contained: 800, escalated: 4000 };
    for (const type of AMBIENT_TYPES)
      for (const outcome of outcomes)
        for (const origin of ORIGINS) {
          const event = {
            id: 1,
            type,
            severity: 2,
            origin,
            target: origin,
            outcome,
            latencyMs: maxLatency[outcome],
            delayMs: 1000,
          } as ThreatEvent;
          for (const clock of [0, 51071, 86399]) {
            const [r1, r2] = formatAmbientRows(event, clock);
            expect(r1).toMatch(row1);
            expect(r2).toMatch(row2);
            expect(r1.length).toBeLessThanOrEqual(30);
            expect(r2.length).toBeLessThanOrEqual(24);
          }
        }
    for (const [r1, r2] of sampleAmbient(6)) {
      expect(r1).toMatch(row1);
      expect(r2).toMatch(row2);
    }
  });
});

describe('anchor rule', () => {
  it('mirrors only the crown zone in the wide layout', () => {
    expect(NODE_ANCHOR_PX).toBe(13);
    for (const n of NODES) {
      expect(isMirrored(n, 'wide')).toBe(n.zone === 'crown');
      expect(isMirrored(n, 'tall')).toBe(false);
    }
  });
});
