import { describe, expect, it } from 'vitest';
import {
  architectureFindings,
  attackOutcome,
  packetStop,
  trafficBuckets,
} from '../../src/lib/labModels';
import { LABS, labCopy, local } from '../../src/lib/labs';

describe('educational lab models', () => {
  it('matches defenses to entry routes and preserves backup recovery separately', () => {
    expect(attackOutcome('credential', new Set(['mfa']))).toMatchObject({
      entryBlocked: true,
      dataBlocked: true,
    });
    expect(attackOutcome('malware', new Set(['mfa']))).toMatchObject({
      entryBlocked: false,
      dataBlocked: false,
    });
    expect(attackOutcome('malware', new Set(['edr']))).toMatchObject({ entryBlocked: true });
    expect(attackOutcome('credential', new Set(['segment']))).toEqual({
      entryBlocked: false,
      dataBlocked: true,
      backupSafe: true,
    });
    expect(attackOutcome('credential', new Set(['backups']))).toEqual({
      entryBlocked: false,
      dataBlocked: false,
      backupSafe: true,
    });
    expect(attackOutcome('credential', new Set())).toEqual({
      entryBlocked: false,
      dataBlocked: false,
      backupSafe: false,
    });
  });
  it('does not claim an identity boundary exists without the identity component', () => {
    expect(architectureFindings(new Set(['app', 'database']), true, true)).toContain(
      'missingIdentity',
    );
    expect(architectureFindings(new Set(['identity', 'app', 'database']), true, true)).toContain(
      'architectureGood',
    );
    expect(architectureFindings(new Set(['backup']), true, true)).toContain('backupDependency');
    expect(architectureFindings(new Set(), false, false)).toEqual(['emptyArchitecture']);
  });
  it('distinguishes a volume burst from low-volume periodic beaconing', () => {
    const burst = trafficBuckets(80, 100, 'spike');
    const beacon = trafficBuckets(80, 100, 'beacon');
    expect(burst).toHaveLength(24);
    expect(burst.filter((n) => n > 180)).toHaveLength(1);
    expect(burst[12]).toBe(180); // A bucket equal to the threshold is not above it.
    expect(beacon.every((n) => n < 180)).toBe(true);
    expect(trafficBuckets(0, 0, 'spike').every((n) => n >= 0)).toBe(true);
  });
  it('stops packets at the first applicable control and permits authorized reads', () => {
    expect(packetStop('normal', true, true, true)).toBeNull();
    expect(packetStop('unauthorized', true, true, true)).toBe(1);
    expect(packetStop('injection', true, true, true)).toBe(2);
    expect(packetStop('injection', true, false, true)).toBe(3);
    expect(packetStop('injection', true, false, false)).toBeNull();
  });
  it('provides translated copy and six unique child routes', () => {
    expect(new Set(LABS.map((lab) => lab.id)).size).toBe(6);
    const en = labCopy('en'),
      vi = labCopy('vi');
    expect(Object.keys(vi).sort()).toEqual(Object.keys(en).sort());
    expect(Object.values(vi).every((value) => value.trim() && !value.includes('[VI]'))).toBe(true);
    expect(LABS.every((lab) => local(lab.title, 'vi') !== local(lab.title, 'en'))).toBe(true);
  });
});
