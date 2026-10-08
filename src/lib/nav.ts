/** Site map. Paths are language-less; keys point at dictionary entries. */
export interface NavItem {
  key: string;
  path: string;
  descKey?: string;
}

export const SOLUTIONS: NavItem[] = [
  { key: 'nav.consulting', path: '/solutions/consulting/', descKey: 'nav.consulting.desc' },
  { key: 'nav.audit', path: '/solutions/audit/', descKey: 'nav.audit.desc' },
  { key: 'nav.soc', path: '/solutions/soc/', descKey: 'nav.soc.desc' },
];

export const PRIMARY: NavItem[] = [
  { key: 'nav.experience', path: '/experience/' },
  { key: 'nav.blog', path: '/blog/' },
  { key: 'nav.resources', path: '/resources/' },
  { key: 'nav.about', path: '/about/' },
];

export const METHOD: NavItem = { key: 'nav.method', path: '/solutions/#method' };

export const FOOTER_SOLUTIONS: NavItem[] = [...SOLUTIONS, METHOD];

export const FOOTER_EXPERIENCE: NavItem[] = [
  { key: 'nav.journeys', path: '/experience/#journeys' },
  { key: 'nav.scenarios', path: '/experience/#library' },
  { key: 'nav.blog', path: '/blog/' },
  { key: 'nav.resources', path: '/resources/' },
];

export const FOOTER_COMPANY: NavItem[] = [
  { key: 'nav.about', path: '/about/' },
  { key: 'nav.expertise', path: '/about/#expertise' },
  { key: 'nav.careers', path: '/careers/' },
  { key: 'nav.contact', path: '/contact/' },
];

/** True when `current` (language-less) is the item or one of its children. */
export function isCurrent(current: string, itemPath: string): boolean {
  if (itemPath === '/') return current === '/';
  return current === itemPath || current.startsWith(itemPath);
}
