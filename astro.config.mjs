// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  // Self-host fonts so first paint isn't blocked on a third-party stylesheet.
  fonts: [
    { provider: fontProviders.google(), name: 'DM Sans', cssVariable: '--font-dm-sans', weights: [400, 500, 600, 700], styles: ['normal'], fallbacks: ['sans-serif'] },
    { provider: fontProviders.google(), name: 'DM Mono', cssVariable: '--font-dm-mono', weights: [400, 500], styles: ['normal'], fallbacks: ['monospace'] },
    { provider: fontProviders.google(), name: 'Manrope', cssVariable: '--font-manrope', weights: [400, 500, 600, 700, 800], styles: ['normal'], fallbacks: ['sans-serif'] },
  ],
  redirects: {
    '/blog': '/writing/',
    '/blog/[...slug]': '/writing/[...slug]',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
