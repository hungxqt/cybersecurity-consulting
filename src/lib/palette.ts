/**
 * Nexus / Atlas palette (design §2.2, §2.3). Single source for the hex values that
 * src/styles/tokens.css declares; tests/unit/tokens-sync.test.ts keeps the two aligned and
 * tests/unit/contrast.test.ts checks every pair in CONTRAST_PAIRS. No i18n imports.
 */

export type Theme = 'nexus' | 'atlas';

/** Nexus (dark) raw tokens: CSS name without the leading `--` → hex. */
export const NEXUS = {
  'c-carbon': '#0D0F11',
  'c-graphite': '#16191D',
  'c-slate': '#1E2228',
  'c-wire': '#2C323A',
  'c-wire-strong': '#68737F',
  'c-ash': '#98A2AC',
  'c-frost': '#E8ECEF',
  'c-cyan-300': '#86B8E8',
  'c-cyan-700': '#0F4C81',
  'c-flare-400': '#FF6A3D',
  'c-flare-950': '#2A1610',
} as const;

/** Atlas (light) raw tokens. `c-cyan-700` is shared with Nexus (same hex). */
export const ATLAS = {
  'c-drafting': '#F2F4F5',
  'c-sheet': '#FFFFFF',
  'c-grid': '#CBD3DA',
  'c-rule': '#6E7C89',
  'c-graphite-600': '#4A5662',
  'c-ink': '#0F1A24',
  'c-cyan-50': '#DCE7F2',
  'c-cyan-500': '#2F6FAE',
  'c-cyan-700': '#0F4C81',
  'c-flare-700': '#B8381A',
  'c-flare-50': '#FBEAE5',
} as const;

export type RawToken = keyof typeof NEXUS | keyof typeof ATLAS;

/** Every raw token once (the union of both themes). */
export const PALETTE: Record<RawToken, string> = { ...NEXUS, ...ATLAS };

/** Semantic token → raw token, per theme scope (design §2.5, mirrored in tokens.css). */
export const SEMANTIC: Record<Theme, Record<string, RawToken>> = {
  nexus: {
    bg: 'c-carbon',
    surface: 'c-graphite',
    'surface-2': 'c-slate',
    rule: 'c-wire',
    'rule-ui': 'c-wire-strong',
    text: 'c-frost',
    'text-dim': 'c-ash',
    accent: 'c-cyan-300',
    'accent-line': 'c-cyan-300',
    'accent-tint': 'c-slate',
    threat: 'c-flare-400',
    'threat-tint': 'c-flare-950',
    'btn-bg': 'c-frost',
    'btn-text': 'c-carbon',
    focus: 'c-cyan-300',
    'selection-bg': 'c-cyan-700',
    'selection-text': 'c-frost',
  },
  atlas: {
    bg: 'c-drafting',
    surface: 'c-sheet',
    'surface-2': 'c-cyan-50',
    rule: 'c-grid',
    'rule-ui': 'c-rule',
    text: 'c-ink',
    'text-dim': 'c-graphite-600',
    accent: 'c-cyan-700',
    'accent-line': 'c-cyan-500',
    'accent-tint': 'c-cyan-50',
    threat: 'c-flare-700',
    'threat-tint': 'c-flare-50',
    'btn-bg': 'c-ink',
    'btn-text': 'c-drafting',
    focus: 'c-cyan-700',
    'selection-bg': 'c-cyan-50',
    'selection-text': 'c-ink',
  },
};

export interface ContrastPair {
  fg: string;
  bg: string;
  /** 'text' needs ≥ 4.5:1, 'ui' (non-text boundaries, rings) needs ≥ 3:1. */
  kind: 'text' | 'ui';
  theme: Theme;
  /** Human-readable origin, e.g. "text-dim on surface-2". */
  label: string;
}

const SURFACES = ['bg', 'surface', 'surface-2'] as const;

function semanticPairs(theme: Theme): ContrastPair[] {
  const s = SEMANTIC[theme];
  const hex = (name: string) => PALETTE[s[name]!];
  const pair = (fg: string, bg: string, kind: ContrastPair['kind']): ContrastPair => ({
    fg: hex(fg),
    bg: hex(bg),
    kind,
    theme,
    label: `${fg} on ${bg}`,
  });
  const out: ContrastPair[] = [];
  for (const fg of ['text', 'text-dim'])
    for (const bg of [...SURFACES, 'threat-tint']) out.push(pair(fg, bg, 'text'));
  for (const fg of ['accent', 'threat']) for (const bg of SURFACES) out.push(pair(fg, bg, 'text'));
  for (const fg of ['rule-ui', 'accent-line', 'focus'])
    for (const bg of SURFACES) out.push(pair(fg, bg, 'ui'));
  out.push(pair('btn-text', 'btn-bg', 'text'));
  out.push(pair('selection-text', 'selection-bg', 'text'));
  return out;
}

/** Explicit extras from the §2.4 tables that are not part of the generated matrix. */
const EXTRAS: ContrastPair[] = [
  {
    fg: NEXUS['c-carbon'],
    bg: NEXUS['c-flare-400'],
    kind: 'text',
    theme: 'nexus',
    label: 'Critical tag: Carbon on Flare 400',
  },
  {
    fg: NEXUS['c-frost'],
    bg: NEXUS['c-cyan-700'],
    kind: 'text',
    theme: 'nexus',
    label: 'selection: Frost on Cyanotype 700',
  },
  {
    fg: NEXUS['c-frost'],
    bg: NEXUS['c-carbon'],
    kind: 'ui',
    theme: 'nexus',
    label: 'active node ring: Frost on Carbon',
  },
  {
    fg: NEXUS['c-frost'],
    bg: NEXUS['c-slate'],
    kind: 'text',
    theme: 'nexus',
    label: 'illustrative banner: Frost on Slate',
  },
  {
    fg: NEXUS['c-ash'],
    bg: NEXUS['c-slate'],
    kind: 'text',
    theme: 'nexus',
    label: 'illustrative banner: Ash on Slate',
  },
];

export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  ...semanticPairs('nexus'),
  ...semanticPairs('atlas'),
  ...EXTRAS,
];
