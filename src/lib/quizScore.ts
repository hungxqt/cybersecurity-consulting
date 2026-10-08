/** Security-maturity quiz scoring. Pure and deterministic. */

export const DOMAINS = ['govern', 'protect', 'detect', 'respond'] as const;
export type Domain = (typeof DOMAINS)[number];
export type Level = 'initial' | 'developing' | 'defined' | 'managed';

/** Two questions per domain, answered 0 (not in place) to 3 (measured and improved). */
export const QUESTIONS: readonly { id: string; domain: Domain }[] = [
  { id: 'quiz.q1', domain: 'govern' },
  { id: 'quiz.q2', domain: 'govern' },
  { id: 'quiz.q3', domain: 'protect' },
  { id: 'quiz.q4', domain: 'protect' },
  { id: 'quiz.q5', domain: 'detect' },
  { id: 'quiz.q6', domain: 'detect' },
  { id: 'quiz.q7', domain: 'respond' },
  { id: 'quiz.q8', domain: 'respond' },
];

export const MAX_ANSWER = 3;

export interface QuizResult {
  /** 0-100 per domain. */
  perDomain: Record<Domain, number>;
  overall: number;
  level: Level;
  /** Up to two domains scoring below 75, lowest first. */
  focus: Domain[];
}

export function levelFor(score: number): Level {
  if (score >= 75) return 'managed';
  if (score >= 50) return 'defined';
  if (score >= 25) return 'developing';
  return 'initial';
}

const validAnswer = (a: unknown): a is number =>
  typeof a === 'number' && Number.isInteger(a) && a >= 0 && a <= MAX_ANSWER;

/** Returns null unless every question has a valid answer. */
export function scoreQuiz(answers: readonly (number | null | undefined)[]): QuizResult | null {
  if (answers.length !== QUESTIONS.length || !answers.every(validAnswer)) return null;
  const sums: Record<Domain, number> = { govern: 0, protect: 0, detect: 0, respond: 0 };
  const counts: Record<Domain, number> = { govern: 0, protect: 0, detect: 0, respond: 0 };
  QUESTIONS.forEach((q, i) => {
    sums[q.domain] += answers[i] as number;
    counts[q.domain] += 1;
  });
  const perDomain = {} as Record<Domain, number>;
  for (const d of DOMAINS) perDomain[d] = Math.round((sums[d] / (counts[d] * MAX_ANSWER)) * 100);
  const total = (answers as number[]).reduce((a, b) => a + b, 0);
  const overall = Math.round((total / (QUESTIONS.length * MAX_ANSWER)) * 100);
  const focus = [...DOMAINS]
    .filter((d) => perDomain[d] < 75)
    .sort((a, b) => perDomain[a] - perDomain[b] || DOMAINS.indexOf(a) - DOMAINS.indexOf(b))
    .slice(0, 2);
  return { perDomain, overall, level: levelFor(overall), focus };
}

/** Polygon points for a radar chart; values are 0-100, first axis points up. */
export function radarPoints(
  values: readonly number[],
  radius: number,
  cx: number,
  cy: number,
): string {
  const n = values.length;
  return values
    .map((v, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const r = (Math.max(0, Math.min(100, v)) / 100) * radius;
      return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
    })
    .join(' ');
}

export function summarizeQuiz(r: QuizResult): string {
  const parts = DOMAINS.map((d) => `${d} ${r.perDomain[d]}`).join(', ');
  return `Security maturity quiz: overall ${r.overall}/100 (${r.level}). ${parts}.`;
}
