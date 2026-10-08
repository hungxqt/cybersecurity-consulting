/** "Where to next" map. Keys and targets are language-less paths; text comes from the dictionaries. */
export interface Target {
  path: string;
  titleKey: string;
  blurbKey: string;
}

const T = {
  solutions: { path: '/solutions/', titleKey: 'nav.solutions', blurbKey: 'next.solutions' },
  consulting: {
    path: '/solutions/consulting/',
    titleKey: 'nav.consulting',
    blurbKey: 'next.consulting',
  },
  audit: { path: '/solutions/audit/', titleKey: 'nav.audit', blurbKey: 'next.audit' },
  soc: { path: '/solutions/soc/', titleKey: 'nav.soc', blurbKey: 'next.soc' },
  experience: { path: '/experience/', titleKey: 'nav.experience', blurbKey: 'next.experience' },
  resources: { path: '/resources/', titleKey: 'nav.resources', blurbKey: 'next.resources' },
  review: {
    path: '/contact/?topic=consulting',
    titleKey: 'next.review.title',
    blurbKey: 'next.review',
  },
  about: { path: '/about/', titleKey: 'nav.about', blurbKey: 'next.about' },
  careers: { path: '/careers/', titleKey: 'nav.careers', blurbKey: 'next.careers' },
  contact: { path: '/contact/', titleKey: 'nav.contact', blurbKey: 'next.contact' },
} satisfies Record<string, Target>;

/** Ordered rules: the first prefix that matches the current path wins. '/' matches only exactly. */
const RULES: [string, Target[]][] = [
  ['/solutions/consulting/', [T.audit, T.experience]],
  ['/solutions/audit/', [T.soc, T.resources]],
  ['/solutions/soc/', [T.resources, T.contact]],
  ['/solutions/', [T.experience, T.contact]],
  ['/experience/', [T.solutions, T.contact]],
  ['/blog/', [T.resources, T.solutions]],
  ['/resources/', [T.review, T.solutions]],
  ['/about/', [T.careers, T.experience]],
  ['/careers/', [T.about, T.contact]],
  ['/contact/', [T.resources, T.experience]],
];

const FALLBACK = [T.solutions, T.contact];

export function nextSteps(path: string): Target[] {
  if (path === '/') return [T.experience, T.solutions];
  const hit = RULES.find(([prefix]) => path.startsWith(prefix));
  const list = hit ? hit[1] : FALLBACK;
  return list.filter((t) => t.path !== path).slice(0, 2);
}
