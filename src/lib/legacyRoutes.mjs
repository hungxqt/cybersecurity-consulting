/**
 * Legacy URL -> new URL pairs (design §9.3). Single source for astro.config.mjs redirects;
 * public/_redirects is hand-written and checked against this list by tests/unit/redirects.test.ts.
 */
const LANGS = ['en', 'vi'];

const BASE = [
  ['/services/', '/solutions/'],
  ['/services/consulting/', '/solutions/consulting/'],
  ['/services/audit/', '/solutions/audit/'],
  ['/services/soc/', '/solutions/soc/'],
  ['/case-studies/', '/experience/'],
  [
    '/case-studies/logistics-detection-in-minutes/',
    '/experience/scenarios/logistics-soc-onboarding/',
  ],
  ['/case-studies/fintech-soc2-in-five-months/', '/experience/scenarios/fintech-soc2-readiness/'],
  [
    '/case-studies/health-portal-threat-modeling/',
    '/experience/scenarios/health-portal-threat-modeling/',
  ],
];

/** @type {[string, string][]} */
export const LEGACY = LANGS.flatMap((lang) =>
  BASE.map(([from, to]) => [`/${lang}${from}`, `/${lang}${to}`]),
);
