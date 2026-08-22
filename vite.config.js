import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Custom domain (learn.alquranqiratacademy.com) serves from site root.
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    // Full local Quran text (~1.4MB) is intentionally bundled.
    chunkSizeWarningLimit: 2000,
  },
})
