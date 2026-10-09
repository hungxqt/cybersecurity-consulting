import { describe, expect, it } from 'vitest';
import { createKonami, createTapCounter } from '../../src/lib/matrix/sequence';
import { createTimeline, CUES } from '../../src/lib/matrix/timeline';
import { createTopology } from '../../src/lib/matrix/topology';
import { HELP, parseCommand } from '../../src/lib/matrix/terminal';
import * as copy from '../../src/lib/matrix/copy';
import { contrastRatio } from '../../src/lib/contrast';
import { NEXUS } from '../../src/lib/palette';
import { rolldown } from 'rolldown';
import { gzipSync } from 'node:zlib';
const sequence = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'B',
  'A',
];
describe('matrix activation', () => {
  it('keeps the bundled trigger below 1.5 KB gzip', async () => {
    const bundle = await rolldown({
      input: 'src/scripts/matrixTrigger.ts',
      external: (id) => id.endsWith('/matrix/index'),
    });
    try {
      const result = await bundle.generate({ format: 'es', minify: true });
      const code = result.output
        .filter((file) => file.type === 'chunk')
        .map((file) => file.code)
        .join('');
      expect(gzipSync(code).length).toBeLessThanOrEqual(1536);
    } finally {
      await bundle.close();
    }
  });
  it('accepts the code, overlaps, case and non-Latin key codes', () => {
    for (const prefix of [[], ['ArrowUp'], ['x']]) {
      const detector = createKonami();
      const result = [...prefix, ...sequence].map((k) => detector.push(k));
      expect(result.at(-1)).toBe(true);
      expect(result.filter(Boolean)).toHaveLength(1);
    }
    const detector = createKonami();
    sequence.slice(0, 8).forEach((k) => detector.push(k));
    expect(detector.push('β', 'KeyB')).toBe(false);
    expect(detector.push('α', 'KeyA')).toBe(true);
  });
  it('resets after wrong keys and explicit reset', () => {
    const d = createKonami();
    sequence.slice(0, 4).forEach((k) => d.push(k));
    d.push('x');
    expect(sequence.slice(4).some((k) => d.push(k))).toBe(false);
    d.push('ArrowUp');
    d.reset();
    expect(sequence.slice(1).some((k) => d.push(k))).toBe(false);
  });
  it('requires exactly five taps within the window', () => {
    let time = 0;
    const d = createTapCounter({ now: () => time });
    expect(d.push()).toEqual({ activate: false, prevent: false });
    for (let i = 0; i < 3; i++) expect(d.push()).toEqual({ activate: false, prevent: true });
    expect(d.push().activate).toBe(true);
    expect(d.push().activate).toBe(false);
    time = 3001;
    expect(d.push()).toEqual({ activate: false, prevent: false });
  });
});
describe('matrix timeline', () => {
  it('emits every ordered cue once even with large steps', () => {
    const t = createTimeline();
    expect(t.advance(40000)).toEqual(CUES);
    expect(t.advance(100)).toEqual([]);
    expect(t.state.phase).toBe('reveal');
  });
  it('freezes on pause and resets on replay', () => {
    const t = createTimeline();
    t.advance(8000);
    t.pause();
    expect(t.advance(40000)).toEqual([]);
    expect(t.state.elapsed).toBe(8000);
    t.resume();
    t.advance(13000);
    expect(t.state.phase).toBe('attack');
    t.replay();
    expect(t.state).toEqual({ elapsed: 0, paused: false, phase: 'init' });
    expect(t.advance(0)[0]).toEqual(CUES[0]);
  });
  it('orders all six attack stages', () => {
    expect(CUES.filter((c) => c.type === 'stage').map((c) => c.stage)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
describe('documentation topology', () => {
  for (const tier of [0, 1, 2])
    it(`is deterministic, bounded and connected at tier ${tier}`, () => {
      const g = createTopology(17, tier);
      expect(g).toEqual(createTopology(17, tier));
      expect(g.nodes.length).toBe([8, 10, 12][tier]);
      expect(g.links.length).toBe(g.nodes.length - 1);
      expect(new Set(g.discovery).size).toBe(g.nodes.length);
      for (const n of g.nodes) expect(n.ip).toMatch(/^(192\.0\.2|198\.51\.100|203\.0\.113)\.\d+$/);
      const visited = new Set([0]);
      for (let i = 0; i < g.nodes.length; i++)
        for (const [a, b] of g.links) {
          if (visited.has(a)) visited.add(b);
          if (visited.has(b)) visited.add(a);
        }
      expect(visited.size).toBe(g.nodes.length);
      expect(g.nodes[g.attackPath[0]!]!.type).toBe('endpoint');
      expect(g.nodes[g.attackPath.at(-1)!]!.type).toBe('DB');
      for (let i = 1; i < g.attackPath.length; i++)
        expect(
          g.links.some(
            ([a, b]) =>
              (a === g.attackPath[i - 1] && b === g.attackPath[i]) ||
              (b === g.attackPath[i - 1] && a === g.attackPath[i]),
          ),
        ).toBe(true);
    });
});
describe('safe console', () => {
  for (const command of ['help', 'status', 'scan', 'pause', 'resume', 'replay', 'clear', 'exit'])
    it(`parses ${command}`, () =>
      expect(parseCommand(`  ${command.toUpperCase()}  `).type).toBe(command));
  it('normalizes inspection and rejects executable-looking input', () => {
    expect(parseCommand(' inspect   db-01 ')).toEqual({ type: 'inspect', argument: 'DB-01' });
    for (const input of [
      ';rm -rf',
      '<img onerror>',
      'help extra',
      'inspect',
      'inspect DB-01 extra',
    ])
      expect(parseCommand(input).type).toBe('unknown');
    expect(parseCommand('x'.repeat(100)).argument).toHaveLength(80);
    expect(HELP).toContain('inspect');
  });
  it('uses synthetic English copy without credentials or banned wording', () => {
    const text = JSON.stringify(copy);
    expect(text).not.toMatch(/simulat|AKIA[0-9A-Z]{16}|-----BEGIN .*PRIVATE KEY/i);
    expect(text).toContain('SYNTHETIC SECURE CHANNEL');
  });
  it('meets text contrast on the overlay surface', () => {
    for (const color of [
      '#86efac',
      '#ecf3f5',
      '#aab8c1',
      NEXUS['c-cyan-300'],
      NEXUS['c-flare-400'],
    ])
      expect(contrastRatio(color, '#0d0f11')).toBeGreaterThanOrEqual(4.5);
  });
});
