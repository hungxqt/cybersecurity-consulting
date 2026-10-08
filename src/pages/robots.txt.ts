import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('https://hungtran.example');
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /en/design/',
    'Disallow: /vi/design/',
    '',
    `Sitemap: ${new URL('sitemap-index.xml', base).href}`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
