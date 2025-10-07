import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
server: {
  proxy: {
    '/api':         { target: 'https://api.zelty.fr/2.10', changeOrigin: true, rewrite: p => p.replace(/^\/api/, '') },
    '/api-staging': { target: 'https://api.staging.zelty.co/2.10', changeOrigin: true, rewrite: p => p.replace(/^\/api-staging/, '') },
  }
}

})
