// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://curioustails.sg',
  output: 'static',
  // One canonical URL form. The host 308s /path -> /path/ already; this keeps
  // dev, sitemap, and any new internal links on the trailing-slash form so GSC
  // stops discovering the redirect variants.
  trailingSlash: 'always',
  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [mdx(), sitemap()]
});