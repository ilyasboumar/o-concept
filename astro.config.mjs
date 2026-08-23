import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// Static output — deployed to GitHub Pages from the /o-concept/ subpath
export default defineConfig({
  output: 'static',
  site: 'https://ilyasboumar.github.io',
  base: '/o-concept',
  // /lab is an internal motion sandbox — keep it out of the sitemap.
  // It is also marked noindex and linked from nowhere.
  integrations: [sitemap({ filter: (page) => !page.includes('/lab') })],
  vite: {
    plugins: [tailwindcss()],
  },
});
