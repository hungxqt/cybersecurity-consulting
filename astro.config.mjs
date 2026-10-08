import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { LEGACY } from './src/lib/legacyRoutes.mjs';
import { sitemapFilter } from './src/lib/sitemapFilter.mjs';

// Set SITE_URL in CI / Cloudflare Pages to your real domain.
const site = process.env.SITE_URL ?? 'https://hungtran.example';

export default defineConfig({
  site,
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'never' },
  redirects: {
    '/': '/en/',
    ...Object.fromEntries(LEGACY.map(([from, to]) => [from.replace(/\/$/, ''), to])),
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'vi'],
    routing: { prefixDefaultLocale: true, redirectToDefaultLocale: false },
  },
  integrations: [
    mdx(),
    sitemap({
      filter: sitemapFilter,
      i18n: { defaultLocale: 'en', locales: { en: 'en', vi: 'vi' } },
    }),
  ],
  vite: {
    // Never inline scripts or assets: keeps the CSP free of 'unsafe-inline' for scripts and styles.
    build: { chunkSizeWarningLimit: 700, assetsInlineLimit: 0 },
  },
});
