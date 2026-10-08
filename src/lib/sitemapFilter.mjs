/** Sitemap filter: no legacy redirect routes. */
export const sitemapFilter = (page) => !/\/(services|case-studies)\//.test(page);
