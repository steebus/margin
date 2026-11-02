import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react()],
  // The same path vercel.json rewrites in production.
  server: {
    proxy: {
      '/hc-covers': { target: 'https://assets.hardcover.app', changeOrigin: true, rewrite: path => path.replace(/^\/hc-covers/, '') },
    },
  },
})
