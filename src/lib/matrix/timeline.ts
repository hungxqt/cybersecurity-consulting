import { INIT, ATTACK } from './copy';
export type Phase = 'init' | 'recon' | 'attack' | 'reveal';
export type Cue = {
  at: number;
  phase: Phase;
  type: 'log' | 'stage' | 'phase';
  payload: string;
  stage?: number;
};
export const CUES: Cue[] = (
  [
    { at: 0, phase: 'init', type: 'phase', payload: '01 INIT' },
    ...INIT.map((payload, i): Cue => ({ at: 200 + i * 1250, phase: 'init', type: 'log', payload })),
    {
      at: 7000,
      phase: 'recon',
      type: 'phase',
      payload: '02 RECON / Discovering documentation network',
    },
    { at: 20000, phase: 'attack', type: 'phase', payload: '03 ATTACK / Detection to containment' },
    ...ATTACK.map((payload, stage): Cue => ({
      at: 20500 + stage * 3000,
      phase: 'attack',
      type: 'stage',
      payload,
      stage,
    })),
    { at: 37000, phase: 'reveal', type: 'phase', payload: '04 REVEAL / Access granted' },
  ] satisfies Cue[]
).sort((a, b) => a.at - b.at);
export function createTimeline() {
  let elapsed = 0,
    cursor = 0,
    paused = false;
  return {
    get state() {
      return {
        elapsed,
        paused,
        phase: (elapsed < 7000
          ? 'init'
          : elapsed < 20000
            ? 'recon'
            : elapsed < 37000
              ? 'attack'
              : 'reveal') as Phase,
      };
    },
    advance(dt: number) {
      const fired: Cue[] = [];
      if (paused) return fired;
      elapsed += Math.max(0, dt);
      while (cursor < CUES.length && CUES[cursor]!.at <= elapsed) fired.push(CUES[cursor++]!);
      return fired;
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    replay() {
      elapsed = cursor = 0;
      paused = false;
    },
  };
}
