// @ts-check
import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import sitemap from '@astrojs/sitemap'

const site =
  process.env['PUBLIC_SITE_URL'] ??
  (process.env['VERCEL_PROJECT_PRODUCTION_URL']
    ? `https://${process.env['VERCEL_PROJECT_PRODUCTION_URL']}`
    : process.env['VERCEL_URL']
      ? `https://${process.env['VERCEL_URL']}`
      : 'https://example.vercel.app')

export default defineConfig({
  output: 'static',

  vite: {
    plugins: [tailwindcss()],
  },

  build: {
    inlineStylesheets: 'always',
  },

  integrations: [sitemap()],

  site,
})
