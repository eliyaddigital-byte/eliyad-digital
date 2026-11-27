// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// SITE_URL / BASE_PATH can be overridden at build time (e.g. when a custom domain is connected).
// GitHub Pages project site default: https://eliyaddigital-byte.github.io/eliyad-digital/
const site = process.env.SITE_URL || 'https://eliyaddigital-byte.github.io';
const base = process.env.BASE_PATH || '/eliyad-digital';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  compressHTML: true,
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/thank-you/') && !page.includes('/404') && !page.includes('/media-preview/'),
      i18n: undefined,
    }),
  ],
});
