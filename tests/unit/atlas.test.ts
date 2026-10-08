import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CONTROLS,
  DIM_BAND,
  FW_KEYS,
  GEOMETRY,
  LAYERS,
  LENSES,
  STRIP_PX,
  bandBox,
  controlsOf,
  diamondWidth,
  layerKey,
  requiredStage,
  stripBox,
  type Breakpoint,
} from '@/lib/atlas';
import en from '@/i18n/en.json';

const dict = en as Record<string, string>;
const BPS: Breakpoint[] = ['lg', 'md', 'sm'];

describe('atlas data', () => {
  it('has five layers, bottom to top', () => {
    expect([...LAYERS]).toEqual(['data', 'application', 'identity', 'edge', 'operations']);
  });
  it('has the 21 controls of the design table with per-layer counts 4/4/5/4/4', () => {
    expect(CONTROLS).toHaveLength(21);
    expect(LAYERS.map((l) => controlsOf(l).length)).toEqual([4, 4, 5, 4, 4]);
    expect(new Set(CONTROLS.map((c) => c.id)).size).toBe(21);
  });
  it('gives every control at least one lens text, and consulting covers all', () => {
    for (const c of CONTROLS) {
      expect(Object.keys(c.lenses).length).toBeGreaterThanOrEqual(1);
      expect(c.lenses.consulting).toBeTruthy();
    }
  });
  it('lens counts match the table: audit 16, soc 15', () => {
    expect(CONTROLS.filter((c) => c.lenses.audit)).toHaveLength(16);
    expect(CONTROLS.filter((c) => c.lenses.soc)).toHaveLength(15);
  });
  it('engages at least one control per lens on every layer', () => {
    for (const l of LAYERS)
      for (const lens of LENSES) expect(controlsOf(l).some((c) => c.lenses[lens])).toBe(true);
  });
  it('has every referenced key in en.json', () => {
    const keys = [
      ...LAYERS.map(layerKey),
      ...Object.values(FW_KEYS),
      ...CONTROLS.flatMap((c) => [c.name, ...Object.values(c.lenses)]),
    ];
    expect(keys.filter((k) => !dict[k])).toEqual([]);
  });
  it('keeps marker spots inside the plane and distinct within a layer', () => {
    for (const l of LAYERS) {
      const spots = controlsOf(l).map((c) => `${c.x},${c.y}`);
      expect(new Set(spots).size).toBe(spots.length);
      for (const c of controlsOf(l)) {
        expect(c.x).toBeGreaterThan(5);
        expect(c.x).toBeLessThan(95);
        expect(c.y).toBeGreaterThan(5);
        expect(c.y).toBeLessThan(95);
      }
    }
  });
  it('references only atlas.fw.* keys, never audit.fw.*', () => {
    expect(Object.values(FW_KEYS).every((k) => k.startsWith('atlas.fw.'))).toBe(true);
    for (const f of ['src/lib/atlas.ts', 'src/components/AtlasDiagram.astro'])
      expect(readFileSync(f, 'utf8')).not.toMatch(/audit\.fw\./);
  });
});

describe('atlas geometry', () => {
  it('uses the specified constants per breakpoint', () => {
    expect(GEOMETRY.lg).toEqual({ s: 360, gap: 56, lift: 96, stage: 576 });
    expect(GEOMETRY.md).toEqual({ s: 300, gap: 56, lift: 96, stage: 536 });
    expect(GEOMETRY.sm).toEqual({ s: 200, gap: 52, lift: 56, stage: 408 });
  });
  it('fits the stage budget', () => {
    for (const bp of BPS) expect(requiredStage(bp)).toBeLessThanOrEqual(GEOMETRY[bp].stage);
    expect(requiredStage('lg')).toBeCloseTo(565.4, 0);
    expect(requiredStage('md')).toBeCloseTo(523.0, 0);
    expect(requiredStage('sm')).toBeCloseTo(405.5, 0);
    expect(DIM_BAND).toBe(24);
  });
  it('fits the diamond into the stage inline size', () => {
    expect(diamondWidth('lg')).toBeLessThanOrEqual(557);
    expect(diamondWidth('md')).toBeLessThanOrEqual(498.75);
    expect(diamondWidth('sm')).toBeLessThanOrEqual(324);
  });

  for (const bp of BPS) {
    describe(`breakpoint ${bp}`, () => {
      for (let sel = 0; sel < LAYERS.length; sel++) {
        it(`strips are 44 px, inside the stage and disjoint with layer ${sel} selected`, () => {
          const stage = GEOMETRY[bp].stage;
          const boxes = LAYERS.map((_, i) => stripBox(i, sel, bp));
          boxes.forEach((b, i) => {
            if (i < LAYERS.length - 1) expect(b.height).toBeCloseTo(STRIP_PX, 5);
            else expect(b.height).toBeGreaterThanOrEqual(STRIP_PX);
            expect(b.bottom).toBeGreaterThanOrEqual(0);
            expect(b.top).toBeLessThanOrEqual(stage + 1e-9);
          });
          for (let i = 1; i < boxes.length; i++)
            expect(boxes[i]!.bottom).toBeGreaterThanOrEqual(boxes[i - 1]!.top - 1e-9);
        });

        it(`strip centres match band centres with layer ${sel} selected`, () => {
          LAYERS.forEach((_, i) => {
            const strip = stripBox(i, sel, bp);
            const band = bandBox(i, sel, bp);
            if (i < LAYERS.length - 1) {
              expect(Math.abs(strip.centre - band.centre)).toBeLessThanOrEqual(1);
            } else {
              // The top strip stretches to the stage top: it contains the 44 px target window
              // centred on its band.
              expect(strip.bottom).toBeLessThanOrEqual(band.centre - STRIP_PX / 2 + 1e-9);
              expect(strip.top).toBeGreaterThanOrEqual(band.centre + STRIP_PX / 2);
            }
          });
        });
      }
    });
  }
});
