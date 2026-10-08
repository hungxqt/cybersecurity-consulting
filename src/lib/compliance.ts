import data from '../content/data/frameworks.json';

export const FRAMEWORKS = ['iso27001', 'soc2', 'pci'] as const;
export type FrameworkId = (typeof FRAMEWORKS)[number];
export const AREAS = [
  'risk',
  'access',
  'crypto',
  'logging',
  'incident',
  'vendor',
  'change',
  'continuity',
  'physical',
  'training',
] as const;
export type AreaId = (typeof AREAS)[number];
export type Level = 'core' | 'partial' | 'light';
export const PHASES = ['gap', 'remediate', 'audit'] as const;
export type Phase = (typeof PHASES)[number];

interface FrameworkData {
  weeks: Record<Phase, number>;
  areas: Record<AreaId, Level>;
}
const DATA = data as unknown as Record<FrameworkId, FrameworkData>;

const RANK: Record<Level, number> = { light: 1, partial: 2, core: 3 };

export interface AreaRow {
  area: AreaId;
  /** Strongest requirement among selected frameworks. */
  level: Level;
  byFramework: Partial<Record<FrameworkId, Level>>;
}

/** Control areas that apply to the selection, strongest requirement first, original order within a level. */
export function applicableAreas(selected: readonly FrameworkId[]): AreaRow[] {
  const picked = FRAMEWORKS.filter((f) => selected.includes(f));
  if (picked.length === 0) return [];
  const rows = AREAS.map((area) => {
    const byFramework: Partial<Record<FrameworkId, Level>> = {};
    let top: Level = 'light';
    for (const f of picked) {
      const lvl = DATA[f].areas[area];
      byFramework[f] = lvl;
      if (RANK[lvl] > RANK[top]) top = lvl;
    }
    return { area, level: top, byFramework };
  });
  return rows.sort(
    (a, b) => RANK[b.level] - RANK[a.level] || AREAS.indexOf(a.area) - AREAS.indexOf(b.area),
  );
}

/** Work shared between frameworks: the longest one counts fully, each extra adds 40%. */
const OVERLAP = 0.4;

export function timeline(selected: readonly FrameworkId[]): {
  phases: Record<Phase, number>;
  total: number;
} {
  const picked = FRAMEWORKS.filter((f) => selected.includes(f));
  const phases = { gap: 0, remediate: 0, audit: 0 } as Record<Phase, number>;
  if (picked.length === 0) return { phases, total: 0 };
  for (const p of PHASES) {
    const weeks = picked.map((f) => DATA[f].weeks[p]).sort((a, b) => b - a);
    const [first = 0, ...rest] = weeks;
    phases[p] = Math.round(first + OVERLAP * rest.reduce((s, w) => s + w, 0));
  }
  return { phases, total: PHASES.reduce((s, p) => s + phases[p], 0) };
}

/**
 * True when ramework and at least one other selected framework both require the area at the
 * core level: the work overlaps, so it is done once (shown as "Shared", never by colour alone).
 */
export function isShared(
  row: AreaRow,
  framework: FrameworkId,
  selected: readonly FrameworkId[],
): boolean {
  if (row.byFramework[framework] !== 'core') return false;
  return selected.some((f) => f !== framework && row.byFramework[f] === 'core');
}
