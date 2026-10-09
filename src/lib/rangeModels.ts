export const SYSTEMS = ['edge', 'identity', 'ws17', 'app', 'db', 'backup'] as const;
export type SystemId = (typeof SYSTEMS)[number];
export type SystemState =
  | 'healthy'
  | 'compromised'
  | 'isolated'
  | 'encrypted'
  | 'restored'
  | 'reachable'
  | 'blocked'
  | 'allowed'
  | 'waiting'
  | 'protected';
export interface Environment {
  started: boolean;
  entry: 'password' | 'attachment';
  mfa: boolean;
  edr: boolean;
  segment: boolean;
  backups: boolean;
  revoked: boolean;
  isolated: Set<SystemId>;
}
export const newEnvironment = (): Environment => ({
  started: false,
  entry: 'password',
  mfa: false,
  edr: false,
  segment: false,
  backups: true,
  revoked: false,
  isolated: new Set(),
});
export function networkStates(env: Environment): Record<SystemId, SystemState> {
  const states = Object.fromEntries(SYSTEMS.map((id) => [id, 'healthy'])) as Record<
    SystemId,
    SystemState
  >;
  if (env.started) {
    const entry = env.entry === 'password' ? 'identity' : 'ws17';
    const stopped =
      env.isolated.has(entry) || (env.entry === 'password' ? env.mfa || env.revoked : env.edr);
    states[entry] = stopped ? 'blocked' : 'compromised';
    if (!stopped) {
      states.app = env.isolated.has('app') ? 'isolated' : 'compromised';
      if (states.app === 'compromised')
        states.db = env.segment || env.isolated.has('db') ? 'blocked' : 'compromised';
      if (states.db === 'compromised')
        states.backup = env.backups || env.isolated.has('backup') ? 'protected' : 'compromised';
    }
  }
  for (const id of env.isolated) states[id] = 'isolated';
  return states;
}
export interface DdosConfig {
  legitimate: number;
  attack: number;
  capacity: number;
  rate: number;
  cache: number;
  filter: boolean;
}
export const newDdos = (): DdosConfig => ({
  legitimate: 100,
  attack: 500,
  capacity: 200,
  rate: 1000,
  cache: 0,
  filter: false,
});
export function ddosOutcome(config: DdosConfig, queue = 0) {
  const attackAfterFilter = config.attack * (config.filter ? 0.12 : 1);
  const ratio = Math.min(1, config.rate / Math.max(1, config.legitimate + attackAfterFilter));
  const admittedLegitimate = config.legitimate * ratio;
  const admittedAttack = attackAfterFilter * ratio;
  const cached = (admittedLegitimate * config.cache) / 100;
  const originLegitimate = admittedLegitimate - cached;
  const demand = originLegitimate + admittedAttack;
  const availableForNew = Math.max(0, config.capacity - Math.min(queue, config.capacity));
  const originShare = Math.min(1, availableForNew / Math.max(1, demand));
  const nextQueue = Math.min(100000, Math.max(0, queue + demand - config.capacity));
  return {
    demand,
    nextQueue,
    served: cached + originLegitimate * originShare,
    rejected: config.legitimate - admittedLegitimate,
    filtered: config.attack - admittedAttack,
    latency: nextQueue / Math.max(1, config.capacity),
    overloaded: demand > config.capacity,
  };
}
export const SPREAD_EDGES: readonly (readonly [SystemId, SystemId])[] = [
  ['ws17', 'app'],
  ['app', 'db'],
  ['db', 'backup'],
];
export interface Ransomware {
  wave: number;
  encrypted: Set<SystemId>;
  isolated: Set<SystemId>;
  restored: Set<SystemId>;
  backups: boolean;
}
export const newRansomware = (): Ransomware => ({
  wave: 0,
  encrypted: new Set(['ws17']),
  isolated: new Set(),
  restored: new Set(),
  backups: true,
});
export function spreadWave(state: Ransomware): Ransomware {
  const encrypted = new Set(state.encrypted);
  for (const [from, to] of SPREAD_EDGES)
    if (
      state.encrypted.has(from) &&
      !state.isolated.has(from) &&
      !state.isolated.has(to) &&
      !(to === 'backup' && state.backups)
    )
      encrypted.add(to);
  return { ...state, wave: state.wave + 1, encrypted };
}
export function restoreSystem(state: Ransomware, id: SystemId): boolean {
  if (
    !state.encrypted.has(id) ||
    !state.isolated.has(id) ||
    !state.backups ||
    state.encrypted.has('backup')
  )
    return false;
  state.encrypted.delete(id);
  state.restored.add(id);
  return true;
}
export const PACKETS = [
  {
    id: 'P-01',
    kind: 'normal',
    source: '192.0.2.17',
    destination: '198.51.100.20',
    port: 443,
    approved: true,
    suspicious: false,
    method: 'GET /reports',
    size: 824,
  },
  {
    id: 'P-02',
    kind: 'injection',
    source: '192.0.2.17',
    destination: '198.51.100.20',
    port: 443,
    approved: true,
    suspicious: true,
    method: 'POST /records · write-pattern',
    size: 1472,
  },
  {
    id: 'P-03',
    kind: 'unapproved',
    source: '203.0.113.44',
    destination: '198.51.100.20',
    port: 8080,
    approved: false,
    suspicious: false,
    method: 'GET /admin',
    size: 632,
  },
] as const;
export interface PacketRules {
  sourceRule: boolean;
  portRule: boolean;
  inspectRule: boolean;
}
export function inspectPacket(
  index: number,
  rules: PacketRules,
): 'sourceBlocked' | 'portBlocked' | 'patternBlocked' | 'packetAllow' {
  const p = PACKETS[index]!;
  if (rules.sourceRule && !p.approved) return 'sourceBlocked';
  if (rules.portRule && p.port !== 443) return 'portBlocked';
  if (rules.inspectRule && p.suspicious) return 'patternBlocked';
  return 'packetAllow';
}
export interface AccessContext {
  role: 'employee' | 'administrator' | 'guest';
  device: 'managed' | 'unmanaged';
  location: 'trusted' | 'unfamiliar';
  resource: 'docs' | 'console';
  verified: boolean;
}
export function evaluateAccess(ctx: AccessContext) {
  const checks = [
    ctx.verified,
    ctx.device === 'managed',
    ctx.location === 'trusted',
    ctx.resource === 'console' ? ctx.role === 'administrator' : ctx.role !== 'guest',
  ];
  const denied = checks.indexOf(false);
  const states: SystemState[] = checks.map((_, i) =>
    denied < 0 || i < denied ? 'allowed' : i === denied ? 'blocked' : 'waiting',
  );
  const reason =
    denied < 0
      ? 'accessAllow'
      : (['identityDeny', 'deviceDeny', 'contextDeny', 'resourceDeny'] as const)[denied]!;
  return { states, reason, allowed: denied < 0 } as const;
}
export const PERMISSIONS = [
  { id: 'assume', from: 'developer', to: 'admin' },
  { id: 'invoke', from: 'developer', to: 'app' },
  { id: 'readStorage', from: 'service', to: 'storage' },
  { id: 'adminDb', from: 'admin', to: 'db' },
  { id: 'adminStorage', from: 'admin', to: 'storage' },
  { id: 'appDb', from: 'app', to: 'db' },
  { id: 'storageBackup', from: 'storage', to: 'backup' },
] as const;
export type PermissionId = (typeof PERMISSIONS)[number]['id'];
export type CloudId = 'developer' | 'service' | 'admin' | 'app' | 'db' | 'storage' | 'backup';
export function blastRadius(
  principal: 'developer' | 'service',
  permissions: ReadonlySet<PermissionId>,
): Set<CloudId> {
  const reached = new Set<CloudId>([principal]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of PERMISSIONS)
      if (permissions.has(edge.id) && reached.has(edge.from) && !reached.has(edge.to)) {
        reached.add(edge.to);
        changed = true;
      }
  }
  return reached;
}
