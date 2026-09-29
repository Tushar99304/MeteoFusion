import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// In development the app calls relative URLs (/api/..., /health) and Vite proxies them to the
// FastAPI backend (default :8000). In production the built app is served by FastAPI itself
// (same origin), so no proxy is needed. Override with VITE_PROXY_TARGET if required.
// Vitest config lives in vitest.config.ts to keep this file's types on Vite only.
const PROXY_TARGET = process.env.VITE_PROXY_TARGET || 'http://localhost:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    proxy: {
      '/api': { target: PROXY_TARGET, changeOrigin: true },
      '/health': { target: PROXY_TARGET, changeOrigin: true },
    },
  },
})
