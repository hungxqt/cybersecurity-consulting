import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import en from '../../src/i18n/en.json';
import vi from '../../src/i18n/vi.json';
import { EDGES, NODES, NODE_BY_ID, type NodeId } from '../../src/lib/nexus';
import {
  BOARD,
  JOURNEYS,
  JOURNEY_BY_ID,
  actNumber,
  boardEdges,
  isOption,
  labelBox,
  labelLines,
  ringBox,
  tickBox,
  tokenBox,
  wrapLabel,
  type Box,
  type Journey,
} from '../../src/lib/journeys';

const EN = en as Record<string, string>;
const VI = vi as Record<string, string>;
const M = '\u2212';
const VENDOR = JOURNEY_BY_ID['vendor-account']!;
const LAUNCH = JOURNEY_BY_ID['before-launch']!;

/** Gap between two boxes: 0 when they touch, negative when they overlap. */
function gap(a: Box, b: Box): number {
  const dx = Math.max(a.x0 - b.x1, b.x0 - a.x1);
  const dy = Math.max(a.y0 - b.y1, b.y0 - a.y1);
  if (dx < 0 && dy < 0) return Math.max(dx, dy);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
}

function segDist(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2));
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

const textOf = (j: Journey, i: number) =>
  `${EN[j.beats[i]!.attackerKey]} ${EN[j.beats[i]!.defenderKey]}`.toLowerCase();

describe('journey definitions', () => {
  it('has exactly the two journeys with the right modes and services', () => {
    expect(JOURNEYS.map((j) => j.id)).toEqual(['vendor-account', 'before-launch']);
    expect(VENDOR.attackerMode).toBe('actual');
    expect(LAUNCH.attackerMode).toBe('hypothetical');
    expect(VENDOR.services).toEqual(['soc', 'consulting']);
    expect(LAUNCH.services).toEqual(['consulting', 'audit']);
    expect(VENDOR.acts).toEqual(['recon', 'intrusion', 'detection', 'recovery']);
    expect(VENDOR.beats).toHaveLength(8);
    expect(LAUNCH.beats).toHaveLength(5);
  });

  it('orders beats strictly by `order`, independent of the clock text', () => {
    for (const j of JOURNEYS) {
      j.beats.forEach((b, i) => {
        expect(b.order).toBe(i + 1);
        expect(Number.isInteger(b.order)).toBe(true);
        expect(b.id).toBe(`beat-${i + 1}`);
      });
    }
  });

  it('has one decision with exactly one recommended option', () => {
    for (const j of JOURNEYS) {
      expect(j.decision.options.filter((o) => o.recommended)).toHaveLength(1);
      expect(j.decision.afterBeat).toBeGreaterThanOrEqual(1);
      expect(j.decision.afterBeat).toBeLessThanOrEqual(j.beats.length);
    }
    expect(VENDOR.decision.afterBeat).toBe(5);
    expect(VENDOR.decision.options.map((o) => o.id)).toEqual(['contain', 'observe', 'ask']);
    expect(VENDOR.decision.options.find((o) => o.recommended)?.id).toBe('contain');
    expect(LAUNCH.decision.afterBeat).toBe(2);
    expect(LAUNCH.decision.options.map((o) => o.id)).toEqual(['ship', 'slip', 'compensate']);
    expect(LAUNCH.decision.options.find((o) => o.recommended)?.id).toBe('compensate');
  });

  it('isOption accepts only the journey own option ids', () => {
    expect(isOption(VENDOR, 'contain')).toBe(true);
    expect(isOption(VENDOR, 'ship')).toBe(false);
    expect(isOption(LAUNCH, 'compensate')).toBe(true);
    expect(isOption(LAUNCH, undefined)).toBe(false);
    expect(isOption(LAUNCH, '')).toBe(false);
    expect(isOption(LAUNCH, 42)).toBe(false);
  });

  it('does not collide with scenario slugs', () => {
    const slugs = readdirSync('src/content/cases/en').map((f) => f.replace(/\.mdx?$/, ''));
    for (const j of JOURNEYS) expect(slugs).not.toContain(j.id);
  });

  it('uses U+2212 for negative clock values', () => {
    for (const j of JOURNEYS)
      for (const b of j.beats) {
        expect(b.clock).not.toContain('-');
        expect(b.clock).toMatch(/^[TL](\u2212|\+)/);
      }
  });
});

describe('per-beat tables (design §6.3, verbatim)', () => {
  const vendor = [
    // order, clock, act, attackerAt, compromised, contained
    [1, `T${M}7d`, 'recon', 'phish', [], []],
    [2, `T${M}2d`, 'recon', 'stuffing', [], []],
    [3, 'T+00:00', 'intrusion', 'vpn', ['vpn', 'idp'], []],
    [4, 'T+00:09', 'intrusion', 'data', ['vpn', 'idp', 'data'], []],
    [5, 'T+00:17', 'detection', 'data', ['vpn', 'idp', 'data'], []],
    [6, 'T+00:25', 'detection', null, ['data'], ['vpn', 'idp']],
    [7, 'T+04:00', 'recovery', null, [], ['vpn', 'idp', 'data']],
    [8, 'T+3d', 'recovery', null, [], ['vpn', 'idp', 'data']],
  ] as const;

  it('vendor-account board states', () => {
    expect(
      VENDOR.beats.map((b) => [
        b.order,
        b.clock,
        b.act,
        b.board.attackerAt,
        b.board.compromised,
        b.board.contained,
      ]),
    ).toEqual(vendor.map((r) => [...r]));
  });

  const launch = [
    [
      1,
      `L${M}10d`,
      'design',
      'consulting',
      'recon',
      [],
      [],
      'An attacker would start by listing what the new portal exposes: sign-up, file upload and shared links.',
      "Architecture review maps the portal's data flows and trust boundaries before the design freezes.",
    ],
    [
      2,
      `L${M}9d`,
      'threat-model',
      'consulting',
      'phish',
      ['data'],
      [],
      'An attacker would harvest a shared document link from a forwarded email. The link never expires and needs no sign-in.',
      'The threat model ranks non-expiring public links as the top risk: customer files reachable by anyone holding the URL.',
    ],
    [
      3,
      `L${M}6d`,
      'test',
      'consulting',
      'api',
      ['api'],
      ['data'],
      "An attacker would try broken access control on the portal API: change an id, read someone else's file.",
      'Penetration test of the portal and API with sharing switched off; findings fixed and retested before launch.',
    ],
    [
      4,
      `L${M}3d`,
      'prove',
      'audit',
      'idp',
      ['idp'],
      ['data', 'api'],
      'An attacker would look for the gap between policy and practice, such as an admin account without MFA.',
      'Readiness review checks that the controls the policy describes are switched on in production, and collects the evidence an auditor will ask for.',
    ],
    [
      5,
      `L${M}0`,
      'launch',
      'audit',
      'webapp',
      [],
      ['data', 'api', 'idp'],
      'An attacker who finds the portal now meets expiring links, enforced MFA for staff and monitored sign-ins.',
      'Launch with sharing behind a flag; links expire after 7 days when it is re-enabled; sign-in and API logs flow to monitoring.',
    ],
  ] as const;

  it('before-launch beats and copy', () => {
    expect(
      LAUNCH.beats.map((b) => [
        b.order,
        b.clock,
        b.act,
        b.relatedService,
        b.board.attackerAt,
        b.board.compromised,
        b.board.contained,
        EN[b.attackerKey],
        EN[b.defenderKey],
      ]),
    ).toEqual(launch.map((r) => [...r]));
  });

  it('copy adjustments for beats that must name their attacker node', () => {
    expect(EN['journey.vendor-account.beat.1.attacker']).toBe(
      'Attacker lists vendor staff to target with phishing and finds the remote access portal.',
    );
    expect(EN['journey.vendor-account.beat.7.defender']).not.toMatch(/affected host rebuilt/i);
  });

  it('questions and options match the design', () => {
    expect(EN['journey.vendor-account.decision.question']).toBe(
      'An alert fires: a vendor account signed in from a new country and is listing customer data. What do you do first?',
    );
    expect(EN['journey.vendor-account.decision.contain']).toBe(
      'Disable the account and revoke sessions',
    );
    expect(EN['journey.vendor-account.decision.observe']).toBe(
      'Keep watching to learn what they want',
    );
    expect(EN['journey.vendor-account.decision.ask']).toBe('Email the vendor to confirm');
    expect(EN['journey.before-launch.decision.question']).toBe(
      'Launch is in nine days. The threat model shows shared document links never expire. What do you do?',
    );
    expect(EN['journey.before-launch.decision.ship']).toBe('Ship now, fix later');
    expect(EN['journey.before-launch.decision.slip']).toBe('Delay launch until it is fixed');
    expect(EN['journey.before-launch.decision.compensate']).toBe(
      'Launch with sharing off, fix behind a flag',
    );
  });
});

describe('beat text', () => {
  it('names every beat board node by label or alias (case-insensitive)', () => {
    for (const j of JOURNEYS)
      j.beats.forEach((b, i) => {
        const text = textOf(j, i);
        for (const id of b.boardNodes) {
          const needles = [EN[`nexus.node.${id}.label`]!, ...NODE_BY_ID[id].aliases].map((s) =>
            s.toLowerCase(),
          );
          expect(
            needles.some((n) => text.includes(n)),
            `${j.id} beat ${i + 1} must name ${id}`,
          ).toBe(true);
        }
      });
  });

  it('beat boardNodes sit inside the journey board', () => {
    for (const j of JOURNEYS)
      for (const b of j.beats) for (const id of b.boardNodes) expect(j.boardNodes).toContain(id);
  });

  it('makes no performance claims', () => {
    const claim = /\bwe (detect|respond|contain)\b.*\b\d+\s*(min|minutes|h|hours)\b/i;
    for (const [k, v] of Object.entries(EN)) {
      if (!k.startsWith('journey.')) continue;
      expect(v, k).not.toMatch(claim);
      expect(v, k).not.toMatch(/\b\d+\s*(%|percent)/i);
    }
  });

  it('every referenced key exists in en.json', () => {
    const keys: string[] = [];
    for (const j of JOURNEYS) {
      keys.push(`journey.${j.id}.title`, `journey.${j.id}.coldOpen`, `journey.${j.id}.services`);
      keys.push(`journey.${j.id}.decision.question`, `journey.${j.id}.decision.playbook`);
      for (let n = 1; n <= 4; n++) keys.push(`journey.${j.id}.report.${n}`);
      j.acts.forEach((_, i) => keys.push(`journey.${j.id}.act.${i + 1}`));
      for (const b of j.beats) keys.push(b.attackerKey, b.defenderKey);
      for (const o of j.decision.options) keys.push(o.key, o.outcomeKey);
      for (const id of j.boardNodes) keys.push(`nexus.node.${id}.short`, `nexus.node.${id}.label`);
      for (const b of j.beats) expect(actNumber(j, b)).toBeGreaterThan(0);
    }
    for (const n of NODES) keys.push(`nexus.node.${n.id}.short`);
    keys.push(
      'journey.prev',
      'journey.next',
      'journey.clockLabel',
      'journey.attacker',
      'journey.defender',
      'journey.skip',
      'journey.commit',
      'journey.choose',
      'journey.retry',
      'journey.related',
      'journey.other',
      'journey.illustrative',
      'journey.act',
      'journey.count',
      'journey.strip',
      'journey.timeline',
      'journey.decision.label',
      'journey.decision.at',
      'journey.outcome.chosen',
      'journey.outcome.recommended',
      'journey.outcome.other',
      'journey.report.title',
      'journey.report.changed',
      'journey.report.services',
      'journey.report.cta',
      'journey.board.label',
      'journey.board.hypothetical',
      'journey.board.caption',
      'journey.board.legend.attacker',
      'journey.board.legend.compromised',
      'journey.board.legend.exposed',
      'journey.board.legend.contained',
      'exp.title.dim',
      'exp.title.strong',
      'exp.lede',
      'exp.note.label',
      'exp.note',
      'exp.journeys',
      'exp.scan',
      'exp.references',
      'exp.beats',
      'exp.start',
      'exp.read',
      'home.breach.label',
      'home.breach.lede',
      'nexus.legend.threat',
      'nexus.legend.asset',
      'nexus.legend.sensor',
    );
    for (const k of keys) expect(EN[k], k).toBeTypeOf('string');
    expect(EN['journey.board.hypothetical']).toBe('What an attacker would try');
    expect(EN['journey.board.caption']).toBe(
      'Left to right: internet, perimeter, corporate, crown jewels',
    );
  });
});

describe('situation board invariants', () => {
  it('has exactly 8 existing board nodes, with a layout for each', () => {
    for (const j of JOURNEYS) {
      expect(j.boardNodes).toHaveLength(8);
      expect(new Set(j.boardNodes).size).toBe(8);
      for (const id of j.boardNodes) expect(NODE_BY_ID[id as NodeId]).toBeDefined();
      expect(Object.keys(j.boardLayout).sort()).toEqual([...j.boardNodes].sort());
    }
  });

  it('keeps the vendor-account and before-launch node sets from the design', () => {
    expect([...VENDOR.boardNodes].sort()).toEqual(
      ['stuffing', 'phish', 'vpn', 'idp', 'laptops', 'edr', 'siem', 'data'].sort(),
    );
    expect([...LAUNCH.boardNodes].sort()).toEqual(
      ['recon', 'phish', 'webapp', 'idp', 'api', 'data', 'backups', 'siem'].sort(),
    );
  });

  it('draws exactly the edges listed in the design', () => {
    expect(
      boardEdges(VENDOR)
        .map((e) => e.id)
        .sort(),
    ).toEqual(['a1', 'a2', 't1', 't2', 't4', 'm1', 'm3', 'm4'].sort());
    expect(
      boardEdges(LAUNCH)
        .map((e) => e.id)
        .sort(),
    ).toEqual(['a4', 't3', 't4', 't5', 't6', 't7', 'm3', 'm5', 'm6', 'm7'].sort());
    // before-launch phish has no drawn edge on purpose
    expect(boardEdges(LAUNCH).some((e) => e.from === 'phish' || e.to === 'phish')).toBe(false);
  });

  it('keeps token, rings and ticks consistent per beat', () => {
    for (const j of JOURNEYS) {
      let prev = new Set<string>();
      for (const b of j.beats) {
        const { attackerAt, compromised, contained } = b.board;
        if (attackerAt !== null) {
          expect(j.boardNodes).toContain(attackerAt);
          expect(b.boardNodes).toContain(attackerAt);
        }
        for (const id of [...compromised, ...contained]) expect(j.boardNodes).toContain(id);
        expect(compromised.filter((id) => contained.includes(id))).toEqual([]);
        for (const id of prev) expect(contained, `${j.id} ${b.id} contained shrinks`).toContain(id);
        prev = new Set(contained);
      }
    }
  });

  it('spaces marks at least 48 units apart', () => {
    for (const j of JOURNEYS) {
      const ids = Object.keys(j.boardLayout);
      for (let a = 0; a < ids.length; a++)
        for (let b = a + 1; b < ids.length; b++) {
          const p = j.boardLayout[ids[a]!]!;
          const q = j.boardLayout[ids[b]!]!;
          expect(Math.hypot(p.x - q.x, p.y - q.y), `${ids[a]} / ${ids[b]}`).toBeGreaterThanOrEqual(
            48,
          );
        }
    }
  });

  it('keeps edges at least 12 units from any mark that is not an endpoint', () => {
    for (const j of JOURNEYS)
      for (const e of boardEdges(j))
        for (const id of j.boardNodes) {
          if (id === e.from || id === e.to) continue;
          const d = segDist(j.boardLayout[id]!, j.boardLayout[e.from]!, j.boardLayout[e.to]!);
          expect(d, `${j.id} ${e.id} near ${id}`).toBeGreaterThanOrEqual(12);
        }
  });

  for (const [lang, dict] of [
    ['en', EN],
    ['vi', VI],
  ] as const) {
    it(`keeps labels, rings, tokens and ticks inside the viewBox and 4 units apart (${lang})`, () => {
      for (const j of JOURNEYS) {
        const labels = j.boardNodes.map((id) => ({
          id,
          box: labelBox(j.boardLayout[id]!, labelLines(dict[`nexus.node.${id}.short`]!, lang)),
        }));
        const obstacles = j.boardNodes.flatMap((id) => {
          const c = j.boardLayout[id]!;
          return [
            { id: `${id}:ring`, box: ringBox(c) },
            { id: `${id}:token`, box: tokenBox(c) },
            { id: `${id}:tick`, box: tickBox(c) },
          ];
        });
        for (const l of labels) {
          expect(l.box.x0, `${j.id} ${l.id}`).toBeGreaterThanOrEqual(0);
          expect(l.box.y0).toBeGreaterThanOrEqual(0);
          expect(l.box.x1).toBeLessThanOrEqual(BOARD.w);
          expect(l.box.y1).toBeLessThanOrEqual(BOARD.h);
          for (const o of obstacles)
            expect(
              gap(l.box, o.box),
              `${j.id} ${lang} label ${l.id} vs ${o.id}`,
            ).toBeGreaterThanOrEqual(4 - 1e-9);
        }
        for (let a = 0; a < labels.length; a++)
          for (let b = a + 1; b < labels.length; b++)
            expect(
              gap(labels[a]!.box, labels[b]!.box),
              `${labels[a]!.id} / ${labels[b]!.id}`,
            ).toBeGreaterThanOrEqual(4);
        for (const o of obstacles) {
          expect(o.box.x0).toBeGreaterThanOrEqual(0);
          expect(o.box.x1 + 0).toBeLessThanOrEqual(BOARD.w);
          expect(o.box.y0).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it(`has short labels of at most two lines at ${BOARD.wrap} characters (${lang})`, () => {
      for (const n of NODES) {
        const v = dict[`nexus.node.${n.id}.short`]!;
        expect(wrapLabel(v, BOARD.wrap).length, `${n.id}: ${v}`).toBeLessThanOrEqual(2);
      }
    });
  }

  it('has English short labels of at most 8 characters, with the specified values', () => {
    const want: Record<string, string> = {
      stuffing: 'Stuffing',
      phish: 'Phishing',
      recon: 'Scanning',
      vpn: 'Remote',
      webapp: 'Web app',
      idp: 'Identity',
      laptops: 'Laptops',
      edr: 'EDR',
      siem: 'SIEM',
      api: 'Payments',
      data: 'Database',
      backups: 'Backups',
      ransom: 'Ransom',
      mailgw: 'Mail gw',
    };
    expect(NODES).toHaveLength(14);
    for (const n of NODES) {
      expect(EN[`nexus.node.${n.id}.short`]).toBe(want[n.id]);
      expect(EN[`nexus.node.${n.id}.short`]!.length).toBeLessThanOrEqual(8);
    }
  });

  it('wraps greedily and upper-cases only English', () => {
    expect(wrapLabel('Web app', 8)).toEqual(['Web app']);
    expect(wrapLabel('[VI] Payments', 8)).toEqual(['[VI]', 'Payments']);
    expect(wrapLabel('', 8)).toEqual([]);
    expect(labelLines('Web app', 'en')).toEqual(['WEB APP']);
    expect(labelLines('Web app', 'vi')).toEqual(['Web app']);
  });

  it('uses only edges that exist in the Nexus graph', () => {
    const ids = new Set(EDGES.map((e) => e.id));
    for (const j of JOURNEYS) for (const e of boardEdges(j)) expect(ids.has(e.id)).toBe(true);
  });
});
