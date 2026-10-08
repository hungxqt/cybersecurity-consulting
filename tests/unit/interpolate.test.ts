import { describe, expect, it } from 'vitest';
import { interpolate } from '@/lib/interpolate';
import { interpolate as reexported } from '@/lib/i18n';

describe('interpolate', () => {
  it('replaces known tokens', () => {
    expect(interpolate('Hello {name}', { name: 'Sam' })).toBe('Hello Sam');
    expect(interpolate('{n} of {total}', { n: 2, total: 5 })).toBe('2 of 5');
  });
  it('leaves unknown tokens visible', () => {
    expect(interpolate('Hi {a} {b}', { a: 1 })).toBe('Hi 1 {b}');
  });
  it('returns the text unchanged without vars', () => {
    expect(interpolate('Plain {x}')).toBe('Plain {x}');
  });
  it('is re-exported unchanged from lib/i18n', () => {
    expect(reexported).toBe(interpolate);
  });
});
