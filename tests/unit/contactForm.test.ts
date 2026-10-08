import { describe, expect, it } from 'vitest';
import { clean, prefillFromQuery, validateContact, type ContactValues } from '@/lib/contactForm';

const good: ContactValues = {
  name: 'Sam Doe',
  email: 'sam@example.com',
  company: '',
  topic: 'soc',
  role: '',
  message: 'We would like a SOC proposal.',
  consent: true,
  website: '',
};

describe('validateContact', () => {
  it('accepts a good submission', () => {
    expect(validateContact(good)).toEqual({ ok: true, bot: false, errors: {} });
  });
  it('flags each missing field with its own error', () => {
    const r = validateContact({
      ...good,
      name: ' ',
      email: 'x',
      topic: 'zzz',
      message: 'short',
      consent: false,
    });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(['consent', 'email', 'message', 'name', 'topic']);
  });
  it('validates emails', () => {
    for (const bad of [
      '',
      'a',
      'a@b',
      'a@b.',
      '@b.com',
      'a b@c.com',
      'a@b@c.com',
      'a@.com',
      'a@b..com',
    ]) {
      expect(validateContact({ ...good, email: bad }).errors.email, bad).toBeTruthy();
    }
    for (const ok of ['a@b.co', 'first.last+tag@sub.example.org', ' trim@example.com ']) {
      expect(validateContact({ ...good, email: ok }).errors.email, ok).toBeUndefined();
    }
  });
  it('enforces length limits', () => {
    expect(validateContact({ ...good, name: 'x'.repeat(101) }).errors.name).toBeTruthy();
    expect(validateContact({ ...good, message: 'x'.repeat(4001) }).errors.message).toBeTruthy();
    expect(validateContact({ ...good, message: 'x'.repeat(10) }).errors.message).toBeUndefined();
    expect(validateContact({ ...good, message: 'x'.repeat(9) }).errors.message).toBeTruthy();
  });
  it('treats a filled honeypot as a bot', () => {
    const r = validateContact({ ...good, website: 'http://spam.example' });
    expect(r.bot).toBe(true);
    expect(r.ok).toBe(false);
  });
});

describe('prefillFromQuery', () => {
  it('maps a role to careers', () => {
    expect(prefillFromQuery('?role=penetration-tester')).toEqual({
      role: 'penetration-tester',
      topic: 'careers',
    });
  });
  it('rejects malformed roles', () => {
    expect(prefillFromQuery('?role=../../etc/passwd')).toEqual({});
    expect(prefillFromQuery('?role=' + 'a'.repeat(61))).toEqual({});
    expect(prefillFromQuery('?role=<script>')).toEqual({});
  });
  it('fills the message from a scan, then quiz, then hunt (first match wins)', () => {
    const scan = prefillFromQuery(
      '?domain=example.com&scan=' +
        encodeURIComponent('Simulated scan of example.com: risk 62/100'),
    );
    expect(scan.source).toBe('scan');
    expect(scan.topic).toBe('audit');
    expect(scan.message).toContain('example.com');
    expect(prefillFromQuery('?quiz=Q&scan=S').source).toBe('scan');
    expect(prefillFromQuery('?quiz=Quiz+result').source).toBe('quiz');
    expect(prefillFromQuery('?hunt=THREAT-HUNTER').message).toContain('THREAT-HUNTER');
  });
  it('sanitises control characters and caps length', () => {
    expect(clean('a\u0000b\u0007c\nd', 10)).toBe('abc\nd');
    const long = prefillFromQuery('?scan=' + 'x'.repeat(5000));
    expect(long.message!.length).toBeLessThanOrEqual(802);
    expect(prefillFromQuery('?hunt=' + encodeURIComponent('<b>X</b>')).message).toBe(
      'Threat hunt code: bX/b\n\n'.replace('/', ''),
    );
  });
  it('returns nothing for an empty query', () => {
    expect(prefillFromQuery('')).toEqual({});
  });
});
