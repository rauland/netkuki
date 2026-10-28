// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://netkuki.com',
  output: 'static',
  integrations: [sitemap()],
  // Self-host fonts so first paint isn't blocked on a third-party stylesheet.
  fonts: [
    { provider: fontProviders.google(), name: 'DM Sans', cssVariable: '--font-dm-sans', weights: [400, 500, 600, 700], styles: ['normal'], fallbacks: ['sans-serif'] },
    { provider: fontProviders.google(), name: 'DM Mono', cssVariable: '--font-dm-mono', weights: [400, 500], styles: ['normal'], fallbacks: ['monospace'] },
    { provider: fontProviders.google(), name: 'Manrope', cssVariable: '--font-manrope', weights: [400, 500, 600, 700, 800], styles: ['normal'], fallbacks: ['sans-serif'] },
  ],
  redirects: {
    '/blog': '/notes/',
    '/writing': '/notes/',
    '/blog/[...slug]': '/notes/[...slug]',
    '/writing/[...slug]': '/notes/[...slug]',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
