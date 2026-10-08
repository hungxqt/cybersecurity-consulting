/**
 * Simulated attack-surface scan. Pure and deterministic: the "findings" are derived from a hash
 * of the typed domain and say nothing about the real domain. No network access of any kind.
 */
import { mulberry32 } from './threatSim';

export type DomainResult =
  { ok: true; domain: string } | { ok: false; reason: 'empty' | 'invalid' | 'ip' | 'too-long' };

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

/** Validate and normalise user input into an ASCII (punycode) hostname. */
export function parseDomain(input: string): DomainResult {
  let raw = input.trim().toLowerCase();
  if (raw === '') return { ok: false, reason: 'empty' };
  if (raw.length > 2048) return { ok: false, reason: 'too-long' };

  raw = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//, ''); // scheme
  raw = raw.split(/[/?#]/)[0] ?? ''; // path, query, fragment
  raw = raw.replace(/^[^@]*@/, ''); // credentials
  raw = raw.replace(/:\d+$/, ''); // port
  raw = raw.replace(/\.$/, ''); // trailing dot
  if (raw === '') return { ok: false, reason: 'invalid' };

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(raw) || raw.includes(':') || /^\[.*\]$/.test(raw)) {
    return { ok: false, reason: 'ip' };
  }

  let host: string;
  try {
    // URL performs IDNA/punycode conversion for unicode hostnames.
    host = new URL(`http://${raw}`).hostname;
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (host.length > 253) return { ok: false, reason: 'too-long' };

  const labels = host.split('.');
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l)))
    return { ok: false, reason: 'invalid' };
  const tld = labels[labels.length - 1] as string;
  if (!/^([a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(tld)) return { ok: false, reason: 'invalid' };
  if (['localhost', 'local', 'internal'].includes(tld)) return { ok: false, reason: 'invalid' };
  return { ok: true, domain: host };
}

/** FNV-1a 32-bit. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export type TlsGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
export type RiskBand = 'low' | 'medium' | 'high' | 'critical';
export type SpfState = 'pass' | 'softfail' | 'missing';
export type DmarcState = 'reject' | 'quarantine' | 'none' | 'missing';

export interface ExposedService {
  port: number;
  service: string;
  risk: 'medium' | 'high';
}

export interface ScanReport {
  domain: string;
  tlsGrade: TlsGrade;
  exposedServices: ExposedService[];
  missingHeaders: string[];
  email: { spf: SpfState; dkim: boolean; dmarc: DmarcState };
  subdomains: number;
  riskScore: number;
  band: RiskBand;
}

export const SCAN_STEPS = [
  'scan.step.dns',
  'scan.step.subdomains',
  'scan.step.tls',
  'scan.step.ports',
  'scan.step.headers',
  'scan.step.email',
  'scan.step.score',
] as const;

const SERVICE_POOL: ExposedService[] = [
  { port: 21, service: 'ftp', risk: 'medium' },
  { port: 22, service: 'ssh', risk: 'medium' },
  { port: 3306, service: 'mysql', risk: 'high' },
  { port: 3389, service: 'rdp', risk: 'high' },
  { port: 5432, service: 'postgres', risk: 'high' },
  { port: 6379, service: 'redis', risk: 'high' },
  { port: 8080, service: 'http-admin', risk: 'medium' },
  { port: 9200, service: 'elasticsearch', risk: 'high' },
];

const HEADER_POOL = [
  'Content-Security-Policy',
  'Strict-Transport-Security',
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Referrer-Policy',
  'Permissions-Policy',
];

const TLS_WEIGHTS: [TlsGrade, number][] = [
  ['A+', 14],
  ['A', 30],
  ['B', 26],
  ['C', 16],
  ['D', 9],
  ['F', 5],
];
const TLS_PENALTY: Record<TlsGrade, number> = { 'A+': 0, A: 3, B: 10, C: 20, D: 30, F: 40 };

function weighted<T>(rand: () => number, items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let x = rand() * total;
  for (const [v, w] of items) {
    x -= w;
    if (x < 0) return v;
  }
  return items[items.length - 1]![0];
}

function pickSome<T>(rand: () => number, pool: readonly T[], max: number): T[] {
  const copy = [...pool];
  const count = Math.floor(rand() * (max + 1));
  const out: T[] = [];
  for (let i = 0; i < count && copy.length; i++) {
    out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0] as T);
  }
  return out;
}

export function bandFor(score: number): RiskBand {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

/** Deterministic fake report for an already validated domain. */
export function runScan(domain: string): ScanReport {
  const rand = mulberry32(hashSeed(domain));
  const tlsGrade = weighted(rand, TLS_WEIGHTS);
  const exposedServices = pickSome(rand, SERVICE_POOL, 3).sort((a, b) => a.port - b.port);
  const missingHeaders = pickSome(rand, HEADER_POOL, 5);
  const spf = weighted<SpfState>(rand, [
    ['pass', 60],
    ['softfail', 20],
    ['missing', 20],
  ]);
  const dmarc = weighted<DmarcState>(rand, [
    ['reject', 25],
    ['quarantine', 20],
    ['none', 30],
    ['missing', 25],
  ]);
  const dkim = rand() < 0.7;
  const subdomains = 3 + Math.floor(rand() * 38);

  let score = TLS_PENALTY[tlsGrade];
  for (const s of exposedServices) score += s.risk === 'high' ? 12 : 6;
  score += Math.min(18, missingHeaders.length * 3);
  score += { pass: 0, softfail: 3, missing: 8 }[spf];
  score += { reject: 0, quarantine: 2, none: 6, missing: 10 }[dmarc];
  score += dkim ? 0 : 4;
  score += Math.min(8, Math.floor(subdomains / 6));
  const riskScore = Math.max(0, Math.min(100, Math.round(score)));

  return {
    domain,
    tlsGrade,
    exposedServices,
    missingHeaders,
    email: { spf, dkim, dmarc },
    subdomains,
    riskScore,
    band: bandFor(riskScore),
  };
}

/** Plain-English summary used to pre-fill the contact form. */
export function summarize(r: ScanReport): string {
  const services = r.exposedServices.length
    ? r.exposedServices.map((s) => `${s.port}/${s.service}`).join(', ')
    : 'none';
  return [
    `Simulated scan of ${r.domain}: risk ${r.riskScore}/100 (${r.band}).`,
    `TLS ${r.tlsGrade}; exposed services: ${services}; ${r.missingHeaders.length} missing security header(s);`,
    `SPF ${r.email.spf}, DMARC ${r.email.dmarc}, DKIM ${r.email.dkim ? 'present' : 'missing'}.`,
  ].join(' ');
}
