import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  const root = `${(site?.toString() || '').replace(/\/$/, '')}${base}`;
  const body = [
    'User-agent: *',
    'Allow: /',
    `Disallow: ${base}thank-you/`,
    `Disallow: ${base}media-preview/`,
    '',
    `Sitemap: ${root}sitemap-index.xml`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
