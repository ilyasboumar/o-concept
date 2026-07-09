import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Static output — deployed to GitHub Pages from the /o-concept/ subpath
export default defineConfig({
  output: 'static',
  site: 'https://ilyasboumar.github.io',
  base: '/o-concept',
  vite: {
    plugins: [tailwindcss()],
  },
});
