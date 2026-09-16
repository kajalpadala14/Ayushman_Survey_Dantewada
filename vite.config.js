import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/xlsx')) {
            return 'vendor-xlsx';
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
        }
      }
    }
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api/gviz': {
        target: 'https://docs.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gviz/, '')
      }
    }
  }
})
