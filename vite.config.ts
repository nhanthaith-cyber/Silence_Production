import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/Silence_Production/', // Absolute path cho GitHub Pages (tên repository)
  server: {
    proxy: {
      // Proxy Nhanh.vn API để tránh CORS khi development
      '/nhanh-api': {
        target: 'https://open.nhanh.vn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nhanh-api/, ''),
        secure: true,
      },
      // Proxy v3.0 endpoint
      '/nhanh-v3': {
        target: 'https://pos.open.nhanh.vn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nhanh-v3/, ''),
        secure: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
