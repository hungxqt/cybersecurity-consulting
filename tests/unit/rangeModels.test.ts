import { describe, expect, it } from 'vitest';
import {
  newEnvironment,
  networkStates,
  newDdos,
  ddosOutcome,
  newRansomware,
  spreadWave,
  restoreSystem,
  inspectPacket,
  evaluateAccess,
  PERMISSIONS,
  blastRadius,
} from '../../src/lib/rangeModels';
import { executeCommand, completeCommand } from '../../src/lib/rangeTerminal';
import { RANGE_LABS } from '../../src/lib/rangeCatalog';
import { rangeCopy } from '../../src/lib/rangeCopy';

describe('immersive browser models', () => {
  it('stops the appropriate entry route without treating MFA as an endpoint defense', () => {
    const env = newEnvironment();
    env.started = true;
    expect(networkStates(env).db).toBe('compromised');
    env.mfa = true;
    expect(networkStates(env).db).toBe('healthy');
    env.entry = 'attachment';
    expect(networkStates(env).db).toBe('compromised');
    env.isolated.add('ws17');
    expect(networkStates(env).app).toBe('healthy');
  });
  it('queues overload, drains with defenses and preserves admission tradeoffs', () => {
    const config = newDdos();
    expect(ddosOutcome(config).nextQueue).toBe(400);
    config.filter = true;
    expect(ddosOutcome(config, 400).nextQueue).toBe(360);
    config.cache = 80;
    expect(ddosOutcome(config, 400).nextQueue).toBe(280);
    config.rate = 10;
    expect(ddosOutcome(config).rejected).toBeGreaterThan(90);
    expect(ddosOutcome({ ...newDdos(), legitimate: 0, attack: 0 }).served).toBe(0);
    expect(ddosOutcome(newDdos(), 100000).nextQueue).toBe(100000);
  });
  it('propagates one hop per wave and requires isolation plus a clean recovery source', () => {
    let state = newRansomware();
    state = spreadWave(state);
    expect([...state.encrypted]).toEqual(['ws17', 'app']);
    expect(state.encrypted.has('db')).toBe(false);
    state.isolated.add('app');
    expect(spreadWave(state).encrypted.has('db')).toBe(false);
    expect(restoreSystem(state, 'ws17')).toBe(false);
    state.isolated.add('ws17');
    expect(restoreSystem(state, 'ws17')).toBe(true);
    expect(state.restored.has('ws17')).toBe(true);
    state = newRansomware();
    state.backups = false;
    for (let i = 0; i < 3; i++) state = spreadWave(state);
    expect(state.encrypted.has('backup')).toBe(true);
    state.backups = true;
    state.isolated.add('db');
    expect(restoreSystem(state, 'db')).toBe(false);
  });
  it('evaluates packet rules in source, transport and application order', () => {
    const rules = { sourceRule: true, portRule: true, inspectRule: true };
    expect(inspectPacket(0, rules)).toBe('packetAllow');
    expect(inspectPacket(1, rules)).toBe('patternBlocked');
    expect(inspectPacket(2, rules)).toBe('sourceBlocked');
    expect(inspectPacket(2, { ...rules, sourceRule: false })).toBe('portBlocked');
    expect(inspectPacket(2, { ...rules, sourceRule: false, portRule: false })).toBe('packetAllow');
  });
  it('stops later zero-trust evaluation after a failed checkpoint', () => {
    const context = {
      role: 'employee',
      device: 'managed',
      location: 'trusted',
      resource: 'docs',
      verified: true,
    } as const;
    expect(evaluateAccess(context).allowed).toBe(true);
    expect(evaluateAccess({ ...context, verified: false }).states).toEqual([
      'blocked',
      'waiting',
      'waiting',
      'waiting',
    ]);
    expect(evaluateAccess({ ...context, resource: 'console' }).reason).toBe('resourceDeny');
    expect(evaluateAccess({ ...context, role: 'administrator', resource: 'console' }).allowed).toBe(
      true,
    );
  });
  it('retains alternate permission paths and never traverses edges backwards', () => {
    const permissions = new Set(PERMISSIONS.map((edge) => edge.id));
    expect(blastRadius('developer', permissions).has('db')).toBe(true);
    permissions.delete('assume');
    expect(blastRadius('developer', permissions).has('db')).toBe(true);
    expect(blastRadius('developer', permissions).has('storage')).toBe(false);
    permissions.delete('invoke');
    expect([...blastRadius('developer', permissions)]).toEqual(['developer']);
    expect([...blastRadius('service', new Set(['readStorage']))]).toEqual(['service', 'storage']);
  });
  it('interprets a closed command language and rejects shell syntax and prototype keys', () => {
    const env = newEnvironment(),
      ddos = newDdos();
    expect(executeCommand('isolate WS-17', env, ddos).kind).toBe('changed');
    expect(env.isolated.has('ws17')).toBe(true);
    for (const command of [
      'isolate __proto__',
      'help; fetch()',
      'cache -1',
      'cache 99',
      'rate-limit 2000',
      'enable mfa extra',
      'inspect constructor',
      '<img src=x onerror=alert(1)>',
    ])
      expect(executeCommand(command, env, ddos).kind).toBe('unknown');
    executeCommand('rate-limit 200', env, ddos);
    expect(ddos.rate).toBe(200);
    executeCommand('cache 80', env, ddos);
    expect(ddos.cache).toBe(80);
    executeCommand('revoke session-04', env, ddos);
    expect(env.revoked).toBe(true);
    expect(completeCommand('iso')).toBe('isolate WS-17');
  });
  it('defines eight distinct bilingual experiences and complete control copy', () => {
    expect(new Set(RANGE_LABS.map((lab) => lab.id)).size).toBe(8);
    expect(Object.keys(rangeCopy('vi'))).toEqual(Object.keys(rangeCopy('en')));
    expect(
      Object.values(rangeCopy('vi')).every((value) => value.trim() && !value.includes('[VI]')),
    ).toBe(true);
  });
});
