import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// Static output — deployed to GitHub Pages from the /o-concept/ subpath
export default defineConfig({
  output: 'static',
  site: 'https://ilyasboumar.github.io',
  base: '/o-concept',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
