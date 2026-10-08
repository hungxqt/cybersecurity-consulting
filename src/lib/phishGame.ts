/** Phish or Not? Round definitions and scoring. Text lives in the i18n dictionaries (phish.<id>.*). */
export interface Round {
  id: number;
  phish: boolean;
  channel: 'email' | 'sms';
}

export const ROUNDS: readonly Round[] = [
  { id: 1, phish: true, channel: 'email' },
  { id: 2, phish: false, channel: 'email' },
  { id: 3, phish: true, channel: 'sms' },
  { id: 4, phish: false, channel: 'email' },
  { id: 5, phish: true, channel: 'email' },
  { id: 6, phish: false, channel: 'email' },
  { id: 7, phish: true, channel: 'email' },
  { id: 8, phish: true, channel: 'email' },
  { id: 9, phish: false, channel: 'email' },
  { id: 10, phish: true, channel: 'email' },
];

export function isCorrect(round: Round, guessedPhish: boolean): boolean {
  return round.phish === guessedPhish;
}

/** Number of correct guesses. `guesses[i]` is the guess for ROUNDS[i]; missing guesses count as wrong. */
export function scoreGame(guesses: readonly (boolean | null | undefined)[]): number {
  return ROUNDS.reduce((s, r, i) => {
    const g = guesses[i];
    return s + (typeof g === 'boolean' && isCorrect(r, g) ? 1 : 0);
  }, 0);
}

export type Verdict = 'high' | 'mid' | 'low';
export function verdictFor(score: number): Verdict {
  if (score >= 9) return 'high';
  if (score >= 6) return 'mid';
  return 'low';
}
