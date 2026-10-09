import { localizedPath, type Lang } from './i18n';

export const BLOG_PAGE_SIZE = 6;

export function blogPagePath(lang: Lang, page: number): string {
  return localizedPath(lang, page === 1 ? '/blog/' : `/blog/page/${page}/`);
}
