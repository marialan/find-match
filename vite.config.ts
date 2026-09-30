import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// ES module scripts are CORS-blocked on a file:// origin, which is the ship-time
// runtime (DEVSPEC Module 10), so the bundle ships as one deferred classic script.
const classicScriptTag = {
  name: 'classic-script-tag',
  enforce: 'post' as const,
  transformIndexHtml(html: string) {
    return html
      .replace(/\s+type="module"/g, ' defer')
      .replace(/\s+crossorigin/g, '')
  },
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), classicScriptTag],
  build: {
    target: 'es2017',
    modulePreload: false,
    rollupOptions: {
      output: { format: 'iife' },
    },
  },
  server: {
    watch: {
      ignored: [
        '**/*.ttf', '**/*.woff', '**/*.woff2', '**/*.png', '**/*.jpg', '**/*.jpeg',
        '**/src/assets/fonts/**', '**/dist/**', '**/artifacts/**',
      ],
    },
  },
})
