import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Static output — deployable to Cloudflare Pages (NODE_VERSION=22.16.0)
export default defineConfig({
  output: 'static',
  site: 'https://theoconcept.pages.dev',
  vite: {
    plugins: [tailwindcss()],
  },
});
