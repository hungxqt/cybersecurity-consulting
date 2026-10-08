import { describe, expect, it } from 'vitest';
import { bandFor, hashSeed, parseDomain, runScan, summarize } from '@/lib/scanSim';

describe('parseDomain', () => {
  const ok = (s: string) => {
    const r = parseDomain(s);
    return r.ok ? r.domain : r.reason;
  };
  it('accepts plain domains and normalises case/whitespace', () => {
    expect(ok('  Example.COM ')).toBe('example.com');
    expect(ok('sub.domain.co.uk')).toBe('sub.domain.co.uk');
  });
  it('strips scheme, path, query, port, credentials and trailing dot', () => {
    expect(ok('https://user:pw@example.com:8443/a/b?c=d#e')).toBe('example.com');
    expect(ok('example.com.')).toBe('example.com');
  });
  it('converts unicode (IDN) to punycode', () => {
    expect(ok('bücher.de')).toBe('xn--bcher-kva.de');
    expect(ok('việtnam.vn')).toMatch(/^xn--.+\.vn$/);
  });
  it('rejects empty and whitespace', () => {
    expect(ok('')).toBe('empty');
    expect(ok('   ')).toBe('empty');
  });
  it('rejects IP addresses', () => {
    expect(ok('192.168.0.1')).toBe('ip');
    expect(ok('http://10.0.0.1/admin')).toBe('ip');
    expect(ok('[::1]')).toBe('ip');
  });
  it('rejects single labels, localhost and malformed names', () => {
    for (const bad of [
      'localhost',
      'foo',
      'a..b.com',
      '-a.com',
      'a-.com',
      'exa mple.com',
      'foo.c',
      'foo.123',
      'foo.local',
      '.com',
    ]) {
      expect(parseDomain(bad).ok, bad).toBe(false);
    }
  });
  it('rejects very long input and over-long hostnames', () => {
    expect(ok('a'.repeat(3000) + '.com')).toBe('too-long');
    expect(ok(`${'a'.repeat(64)}.com`)).toBe('invalid');
    const long = Array(6).fill('a'.repeat(50)).join('.') + '.com';
    expect(ok(long)).toBe('too-long');
  });
  it('does not treat script-like input as a domain', () => {
    expect(parseDomain('<script>alert(1)</script>.com').ok).toBe(false);
  });
});

describe('runScan', () => {
  it('is deterministic per domain and differs between domains', () => {
    expect(runScan('example.com')).toEqual(runScan('example.com'));
    expect(runScan('example.com')).not.toEqual(runScan('example.org'));
  });
  it('keeps values in range across many domains', () => {
    for (let i = 0; i < 500; i++) {
      const r = runScan(`site${i}.com`);
      expect(r.riskScore).toBeGreaterThanOrEqual(0);
      expect(r.riskScore).toBeLessThanOrEqual(100);
      expect(r.band).toBe(bandFor(r.riskScore));
      expect(r.exposedServices.length).toBeLessThanOrEqual(3);
      expect(new Set(r.missingHeaders).size).toBe(r.missingHeaders.length);
      expect(r.subdomains).toBeGreaterThanOrEqual(3);
    }
  });
  it('produces a spread of risk bands', () => {
    const bands = new Set(Array.from({ length: 500 }, (_, i) => runScan(`d${i}.net`).band));
    expect(bands.size).toBeGreaterThanOrEqual(3);
  });
  it('bands have the documented thresholds', () => {
    expect([
      bandFor(0),
      bandFor(24),
      bandFor(25),
      bandFor(49),
      bandFor(50),
      bandFor(74),
      bandFor(75),
      bandFor(100),
    ]).toEqual(['low', 'low', 'medium', 'medium', 'high', 'high', 'critical', 'critical']);
  });
  it('summary mentions the domain and score', () => {
    const r = runScan('example.com');
    expect(summarize(r)).toContain('example.com');
    expect(summarize(r)).toContain(`${r.riskScore}/100`);
  });
  it('hash is stable', () => {
    expect(hashSeed('example.com')).toBe(hashSeed('example.com'));
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
  });
});
