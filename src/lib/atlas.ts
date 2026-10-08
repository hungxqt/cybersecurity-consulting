/**
 * Security Architecture Atlas data and geometry (design §6.2, §12.3).
 *
 * Pure module: no i18n dictionary import. Controls reference dictionary keys as strings
 * (`atlas.ctl.<id>.<lens>`); a lens key is present only where the §6.2 table has a tick.
 * The geometry constants and box helpers are shared by AtlasDiagram.astro (CSS custom
 * properties) and tests/unit/atlas.test.ts, so the CSS and the spacing test cannot drift.
 */

/** Bottom to top: the order is real, closest to the data first. */
export const LAYERS = ['data', 'application', 'identity', 'edge', 'operations'] as const;
export type LayerId = (typeof LAYERS)[number];

export const LENSES = ['consulting', 'audit', 'soc'] as const;
export type LensId = (typeof LENSES)[number];

export type FrameworkId = 'iso27001' | 'soc2' | 'pci';

/** Short educational names. Never the matrix framework keys, which are full names. */
export const FW_KEYS: Record<FrameworkId, string> = {
  iso27001: 'atlas.fw.iso27001',
  soc2: 'atlas.fw.soc2',
  pci: 'atlas.fw.pci',
};

export interface Control {
  id: string;
  layer: LayerId;
  /** Dictionary key of the control name. */
  name: string;
  /** Lens text keys, present only where the control is in scope for that solution. */
  lenses: Partial<Record<LensId, string>>;
  /** Framework families the audit lens refers to (educational, not a claim). */
  frameworks: FrameworkId[];
  /** Marker position on the plane, in percent of the plane side. */
  x: number;
  y: number;
}

type Row = [
  layer: LayerId,
  id: string,
  consulting: boolean,
  audit: boolean,
  soc: boolean,
  frameworks: FrameworkId[],
];

const I: FrameworkId = 'iso27001';
const S: FrameworkId = 'soc2';
const P: FrameworkId = 'pci';

/** The 21-row table of design §6.2. */
const ROWS: Row[] = [
  ['data', 'enc', true, true, false, [I, S, P]],
  ['data', 'classify', true, true, false, [I, S]],
  ['data', 'backup', true, true, true, [I, S]],
  ['data', 'retention', true, true, false, [I, P]],
  ['application', 'sdlc', true, true, false, [I, S, P]],
  ['application', 'apptest', true, true, false, [P]],
  ['application', 'deps', true, false, true, [I]],
  ['application', 'secrets', true, true, true, [S]],
  ['identity', 'mfa', true, true, true, [I, S, P]],
  ['identity', 'pam', true, true, true, [I, S, P]],
  ['identity', 'jml', true, true, false, [I, S]],
  ['identity', 'cond', true, false, true, []],
  ['identity', 'vendor', true, true, true, [I, S]],
  ['edge', 'exposure', true, false, true, []],
  ['edge', 'waf', true, true, true, [P]],
  ['edge', 'remote', true, true, true, [I, P]],
  ['edge', 'email', true, false, true, []],
  ['operations', 'logging', true, true, true, [I, S, P]],
  ['operations', 'detect', true, false, true, []],
  ['operations', 'ir', true, true, true, [I, S, P]],
  ['operations', 'vuln', true, true, true, [I, S, P]],
];

/** Marker spots per layer (percent of the plane side), spread so markers do not stack on screen. */
const SPOTS: Record<LayerId, [number, number][]> = {
  data: [
    [22, 28],
    [68, 24],
    [34, 66],
    [74, 70],
  ],
  application: [
    [30, 22],
    [72, 34],
    [20, 62],
    [62, 76],
  ],
  identity: [
    [18, 30],
    [52, 18],
    [78, 42],
    [34, 62],
    [66, 78],
  ],
  edge: [
    [26, 34],
    [74, 22],
    [22, 72],
    [64, 64],
  ],
  operations: [
    [20, 24],
    [60, 30],
    [30, 68],
    [76, 72],
  ],
};

function build(): Control[] {
  const seen: Record<string, number> = {};
  return ROWS.map(([layer, id, c, a, s, frameworks]) => {
    const n = (seen[layer] = (seen[layer] ?? -1) + 1);
    const [x, y] = SPOTS[layer][n]!;
    const lenses: Partial<Record<LensId, string>> = {};
    if (c) lenses.consulting = `atlas.ctl.${id}.consulting`;
    if (a) lenses.audit = `atlas.ctl.${id}.audit`;
    if (s) lenses.soc = `atlas.ctl.${id}.soc`;
    return { id, layer, name: `atlas.ctl.${id}.name`, lenses, frameworks, x, y };
  });
}

export const CONTROLS: readonly Control[] = build();

export function controlsOf(layer: LayerId): Control[] {
  return CONTROLS.filter((c) => c.layer === layer);
}

export function layerKey(layer: LayerId): string {
  return `atlas.layer.${layer}`;
}

/** Layer shown selected before any script runs (design §6.2: Identity). */
export const DEFAULT_LAYER: LayerId = 'identity';

// --- geometry --------------------------------------------------------------------------------

export type Breakpoint = 'lg' | 'md' | 'sm';

export interface Geometry {
  /** Plane side, px. */
  s: number;
  /** Vertical step between planes in the Z direction, px. */
  gap: number;
  /** Extra lift of every plane above the selected one, px. */
  lift: number;
  /** Stage block-size, px. */
  stage: number;
}

/** >= 1080 px, 720-1079 px, < 720 px. */
export const GEOMETRY: Record<Breakpoint, Geometry> = {
  lg: { s: 360, gap: 56, lift: 96, stage: 576 },
  md: { s: 300, gap: 56, lift: 96, stage: 536 },
  sm: { s: 200, gap: 52, lift: 56, stage: 408 },
};

export const STRIP_PX = 44;
export const ANCHOR_BASE = 34;
export const DIM_BAND = 24;
/** Distance of the lowest strip's bottom edge from the stage bottom. */
export const STRIP_BOTTOM = 12;
/** sin 60 and the half of it, exactly as written in the CSS calc() expressions. */
export const K = 0.866;
export const K_HALF = 0.433;
/** A square of side s projects to a diamond 1.414 s wide and 0.707 s tall. */
export const DIAMOND_W = 1.414;
export const DIAMOND_H = 0.707;

/** Box of an element measured upwards from the stage bottom, in px. */
export interface Box {
  bottom: number;
  top: number;
  height: number;
  centre: number;
}

const box = (bottom: number, top: number): Box => ({
  bottom,
  top,
  height: top - bottom,
  centre: (bottom + top) / 2,
});

/** Lift applied to plane/strip `i` when `selected` is the selected layer index. */
export function liftOf(i: number, selected: number, bp: Breakpoint): number {
  return i > selected ? GEOMETRY[bp].lift : 0;
}

/** Hit strip of layer `i`. The top layer stretches from the stage top (>= 44 px by construction). */
export function stripBox(i: number, selected: number, bp: Breakpoint): Box {
  const g = GEOMETRY[bp];
  const bottom = STRIP_BOTTOM + i * K * g.gap + K * liftOf(i, selected, bp);
  const top = i === LAYERS.length - 1 ? g.stage : bottom + STRIP_PX;
  return box(bottom, top);
}

/**
 * Visible front band of layer `i`: the K*gap region above the plane's projected front vertex,
 * lift included. The `.atlas__iso` anchor puts the Data front vertex at 34 - 0.433*gap.
 */
export function bandBox(i: number, selected: number, bp: Breakpoint): Box {
  const g = GEOMETRY[bp];
  const bottom = ANCHOR_BASE - K_HALF * g.gap + i * K * g.gap + K * liftOf(i, selected, bp);
  return box(bottom, bottom + K * g.gap);
}

/** Minimum stage block-size for the geometry (largest lift case: Data selected). */
export function requiredStage(bp: Breakpoint): number {
  const g = GEOMETRY[bp];
  return (
    ANCHOR_BASE -
    K_HALF * g.gap +
    DIAMOND_H * g.s +
    (LAYERS.length - 1) * K * g.gap +
    K * g.lift +
    DIM_BAND
  );
}

export function diamondWidth(bp: Breakpoint): number {
  return DIAMOND_W * GEOMETRY[bp].s;
}

/** Selected index for a layer id. */
export function layerIndex(layer: LayerId): number {
  return LAYERS.indexOf(layer);
}
