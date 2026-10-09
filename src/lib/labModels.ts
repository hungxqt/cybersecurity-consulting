export type Defense = 'mfa' | 'edr' | 'segment' | 'backups';
export function attackOutcome(route: 'credential' | 'malware', defenses: ReadonlySet<Defense>) {
  const entryBlocked = defenses.has(route === 'credential' ? 'mfa' : 'edr');
  const dataBlocked = entryBlocked || defenses.has('segment');
  return { entryBlocked, dataBlocked, backupSafe: dataBlocked || defenses.has('backups') };
}
export const COMPONENTS = ['identity', 'endpoint', 'cloud', 'app', 'database', 'backup'] as const;
export type ComponentId = (typeof COMPONENTS)[number];
export function architectureFindings(
  parts: ReadonlySet<ComponentId>,
  privateData: boolean,
  identityGate: boolean,
) {
  const findings: (
    | 'emptyArchitecture'
    | 'missingApp'
    | 'publicData'
    | 'privateDataGood'
    | 'missingIdentity'
    | 'identityGood'
    | 'backupDependency'
    | 'architectureGood'
  )[] = [];
  if (!parts.size) return ['emptyArchitecture'] as const;
  if (parts.has('database')) {
    if (!parts.has('app')) findings.push('missingApp');
    findings.push(privateData ? 'privateDataGood' : 'publicData');
  }
  if (parts.has('app') || parts.has('cloud'))
    findings.push(parts.has('identity') && identityGate ? 'identityGood' : 'missingIdentity');
  if (parts.has('backup') && !parts.has('database')) findings.push('backupDependency');
  if (!findings.length || findings.every((f) => f === 'privateDataGood' || f === 'identityGood'))
    findings.push('architectureGood');
  return findings;
}
export type TrafficPattern = 'spike' | 'beacon' | 'exfil';
export function trafficBuckets(baseline: number, intensity: number, pattern: TrafficPattern) {
  return Array.from({ length: 24 }, (_, minute) => {
    const noise = [0, 8, -4, 12, -8, 5][minute % 6]!;
    const extra =
      pattern === 'spike'
        ? minute >= 10 && minute <= 12
          ? intensity * (minute === 11 ? 2 : 1)
          : 0
        : pattern === 'beacon'
          ? minute % 4 === 0
            ? intensity * 0.3
            : 0
          : minute >= 8 && minute <= 19
            ? intensity
            : 0;
    return Math.round(Math.max(0, baseline + noise + extra));
  });
}
export type RequestType = 'normal' | 'injection' | 'unauthorized';
export function packetStop(
  request: RequestType,
  sourceFilter: boolean,
  waf: boolean,
  leastPrivilege: boolean,
): number | null {
  if (request === 'unauthorized' && sourceFilter) return 1;
  if (request === 'injection' && waf) return 2;
  if (request === 'injection' && leastPrivilege) return 3;
  return null;
}
