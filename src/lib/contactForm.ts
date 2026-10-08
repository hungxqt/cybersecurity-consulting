/** Contact form validation and query-string prefill. Pure so it can be unit tested. */

export const TOPICS = ['consulting', 'audit', 'soc', 'careers', 'other'] as const;
export type Topic = (typeof TOPICS)[number];

export interface ContactValues {
  name: string;
  email: string;
  company: string;
  topic: string;
  message: string;
  consent: boolean;
  /** Honeypot: real visitors never fill this in. */
  website: string;
}

export type ErrorKey = 'name' | 'email' | 'topic' | 'message' | 'consent';
export type ContactErrors = Partial<Record<ErrorKey, string>>;

export const LIMITS = {
  name: 100,
  email: 254,
  company: 120,
  message: 4000,
  minMessage: 10,
} as const;

// Deliberately simple: one @, no spaces, a dot in the domain. The server is the final judge.
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function validateContact(v: ContactValues): {
  ok: boolean;
  bot: boolean;
  errors: ContactErrors;
} {
  const errors: ContactErrors = {};
  const name = v.name.trim();
  const email = v.email.trim();
  const message = v.message.trim();
  if (name === '' || name.length > LIMITS.name) errors.name = 'err.name';
  if (!EMAIL.test(email) || email.length > LIMITS.email) errors.email = 'err.email';
  if (!(TOPICS as readonly string[]).includes(v.topic)) errors.topic = 'err.topic';
  if (message.length < LIMITS.minMessage || message.length > LIMITS.message)
    errors.message = 'err.message';
  if (!v.consent) errors.consent = 'err.consent';
  const bot = v.website.trim() !== '';
  return { ok: Object.keys(errors).length === 0 && !bot, bot, errors };
}

/** Strip control characters and cap the length. */
export function clean(text: string, max: number): string {
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, max);
}

export interface Prefill {
  topic?: Topic;
  message?: string;
  /** Which source filled the message, for the notice text. */
  source?: 'quiz' | 'hunt';
}

/** Read ?topic=, ?quiz=, ?hunt= from a query string. Everything is sanitised. */
export function prefillFromQuery(search: string): Prefill {
  const q = new URLSearchParams(search);
  const out: Prefill = {};

  const topic = q.get('topic');
  if (topic && (TOPICS as readonly string[]).includes(topic)) out.topic = topic as Topic;

  const quiz = q.get('quiz');
  const hunt = q.get('hunt');
  if (quiz) {
    out.message = `${clean(quiz, 800)}\n\n`;
    out.source = 'quiz';
    out.topic = 'consulting';
  } else if (hunt) {
    out.message = `Threat hunt code: ${clean(hunt, 40).replace(/[^A-Za-z0-9-]/g, '')}\n\n`;
    out.source = 'hunt';
  }
  return out;
}
