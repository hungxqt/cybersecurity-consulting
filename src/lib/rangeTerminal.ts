import { SYSTEMS, type DdosConfig, type Environment, type SystemId } from './rangeModels';
export const COMMANDS = [
  'help',
  'status',
  'alerts',
  'inspect WS-17',
  'inspect IAM-04',
  'inspect APP-02',
  'inspect DB-01',
  'isolate WS-17',
  'isolate APP-02',
  'isolate DB-01',
  'revoke session-04',
  'enable mfa',
  'enable segment',
  'enable edr',
  'rate-limit 200',
  'cache 80',
  'filter on',
  'launch password',
  'launch attachment',
  'clear',
  'reset',
] as const;
const ids: Record<string, SystemId> = {
  'WS-17': 'ws17',
  'IAM-04': 'identity',
  'APP-02': 'app',
  'DB-01': 'db',
};
export type CommandResult = {
  kind: 'help' | 'status' | 'alerts' | 'inspect' | 'changed' | 'unknown' | 'clear' | 'reset';
  system?: SystemId;
};
export function executeCommand(raw: string, env: Environment, ddos: DdosConfig): CommandResult {
  const command = raw.trim().replace(/\s+/g, ' ');
  if (command.length > 120) return { kind: 'unknown' };
  const [verb, arg] = command.split(' ');
  if (['help', 'status', 'alerts', 'clear', 'reset'].includes(verb!) && !arg)
    return { kind: verb as CommandResult['kind'] };
  if (verb === 'inspect' && arg && Object.hasOwn(ids, arg) && command === `inspect ${arg}`)
    return { kind: 'inspect', system: ids[arg]! };
  if (verb === 'isolate' && arg && Object.hasOwn(ids, arg) && command === `isolate ${arg}`) {
    env.isolated.add(ids[arg]!);
    return { kind: 'changed', system: ids[arg]! };
  }
  if (command === 'revoke session-04') {
    env.revoked = true;
    return { kind: 'changed', system: 'identity' };
  }
  if (
    verb === 'enable' &&
    (arg === 'mfa' || arg === 'segment' || arg === 'edr') &&
    command === `enable ${arg}`
  ) {
    env[arg] = true;
    return { kind: 'changed' };
  }
  if (
    verb === 'rate-limit' &&
    /^\d{1,4}$/.test(arg ?? '') &&
    command === `rate-limit ${arg}` &&
    Number(arg) >= 10 &&
    Number(arg) <= 1000
  ) {
    ddos.rate = Number(arg);
    return { kind: 'changed' };
  }
  if (
    verb === 'cache' &&
    /^\d{1,2}$/.test(arg ?? '') &&
    command === `cache ${arg}` &&
    Number(arg) <= 90
  ) {
    ddos.cache = Number(arg);
    return { kind: 'changed' };
  }
  if (command === 'filter on') {
    ddos.filter = true;
    return { kind: 'changed' };
  }
  if (command === 'launch password' || command === 'launch attachment') {
    env.started = true;
    env.entry = arg as Environment['entry'];
    return { kind: 'changed' };
  }
  return { kind: 'unknown' };
}
export function completeCommand(prefix: string): string | undefined {
  return COMMANDS.find((command) => command.toLowerCase().startsWith(prefix.toLowerCase()));
}
export const systemStatus = (env: Environment) =>
  SYSTEMS.map((id) => `${id}: ${env.isolated.has(id) ? 'isolated' : 'connected'}`).join(' · ');
