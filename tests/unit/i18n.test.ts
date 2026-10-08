import { describe, expect, it } from 'vitest';
import {
  dictionaries,
  interpolate,
  isLang,
  isPlaceholder,
  localizedHref,
  localizedPath,
  stripLocale,
  switchLocalePath,
  translate,
  type Dict,
  type Lang,
} from '@/lib/i18n';

const dicts: Record<Lang, Dict> = {
  en: {
    hello: 'Hello {name}',
    only_en: 'English only',
    empty: 'Has English',
    todo: 'Todo {name}',
    bare: 'Bare',
    mid: 'Mid',
  },
  vi: {
    hello: 'Xin chào {name}',
    empty: '   ',
    todo: '[VI] Untranslated {name}',
    bare: '[VI]',
    mid: 'Keep [VI] inside',
  },
};

describe('translate', () => {
  it('returns the target language value and interpolates', () => {
    expect(translate(dicts, 'vi', 'hello', { name: 'An' })).toBe('Xin chào An');
  });
  it('falls back to English when the key is missing', () => {
    expect(translate(dicts, 'vi', 'only_en')).toBe('English only');
  });
  it('falls back to English when the value is blank', () => {
    expect(translate(dicts, 'vi', 'empty')).toBe('Has English');
  });
  it('falls back to English for an untranslated [VI] placeholder', () => {
    expect(translate(dicts, 'vi', 'todo', { name: 'An' })).toBe('Todo An');
    expect(translate(dicts, 'vi', 'bare')).toBe('Bare');
  });
  it('keeps a value that merely contains [VI] mid-string', () => {
    expect(translate(dicts, 'vi', 'mid')).toBe('Keep [VI] inside');
  });
  it('detects placeholders', () => {
    expect(isPlaceholder('[VI] x')).toBe(true);
    expect(isPlaceholder('[VI]')).toBe(true);
    expect(isPlaceholder('  ')).toBe(true);
    expect(isPlaceholder(undefined)).toBe(true);
    expect(isPlaceholder('Xin chào')).toBe(false);
  });
  it('returns the key when no dictionary has it', () => {
    expect(translate(dicts, 'en', 'nope.key')).toBe('nope.key');
  });
  it('leaves unknown tokens visible', () => {
    expect(interpolate('Hi {a} {b}', { a: 1 })).toBe('Hi 1 {b}');
  });
});

describe('paths', () => {
  it('validates languages', () => {
    expect(isLang('en')).toBe(true);
    expect(isLang('fr')).toBe(false);
    expect(isLang(undefined)).toBe(false);
  });
  it('builds localized paths with trailing slash', () => {
    expect(localizedPath('vi')).toBe('/vi/');
    expect(localizedPath('en', '/solutions/soc')).toBe('/en/solutions/soc/');
  });
  it('switches language while keeping the page', () => {
    expect(switchLocalePath('/en/solutions/soc/', 'vi')).toBe('/vi/solutions/soc/');
    expect(switchLocalePath('/vi/', 'en')).toBe('/en/');
  });
  it('strips the locale', () => {
    expect(stripLocale('/vi/blog/post/')).toBe('/blog/post/');
    expect(stripLocale('/en/')).toBe('/');
  });
  it('localizes hrefs and keeps the fragment', () => {
    expect(localizedHref('en', '/solutions/#method')).toBe('/en/solutions/#method');
    expect(localizedHref('vi', '/experience/#review')).toBe('/vi/experience/#review');
    expect(localizedHref('vi', '/about/')).toBe('/vi/about/');
    expect(localizedHref('en')).toBe('/en/');
    expect(localizedHref('en', '/contact/?topic=consulting')).toBe('/en/contact/?topic=consulting');
    expect(localizedHref('vi', '/contact/?topic=a#x')).toBe('/vi/contact/?topic=a#x');
    expect(localizedHref('en', '/solutions/soc#')).toBe('/en/solutions/soc/');
  });
});

describe('dictionaries', () => {
  it('vi has exactly the same keys as en', () => {
    expect(Object.keys(dictionaries.vi).sort()).toEqual(Object.keys(dictionaries.en).sort());
  });
});
