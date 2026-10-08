/** Sitemap filter: no specimen page and no legacy redirect routes. */
export const sitemapFilter = (page) =>
  !page.includes('/design/') && !/\/(services|case-studies)\//.test(page);
