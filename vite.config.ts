import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      ignored: [
        '**/*.ttf', '**/*.woff', '**/*.woff2', '**/*.png', '**/*.jpg', '**/*.jpeg',
        '**/src/assets/fonts/**', '**/dist/**', '**/artifacts/**',
      ],
    },
  },
})
