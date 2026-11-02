import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    VitePWA({
      registerType: 'prompt', // a new version waits for the next launch, so nothing reloads mid-use
      includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'Margin',
        short_name: 'Margin',
        description: 'A reading buddy that asks, not tells.',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        theme_color: '#d8d6cf', // --paper in styles/tokens.css
        background_color: '#d8d6cf',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Installed from Chrome on Android, Margin shows in every app's share sheet (see lib/share-read.ts).
        share_target: { action: '/capture/share', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } },
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/hc-covers\//, /^\/art-demo\//],
        runtimeCaching: [{
          // Covers never change, so each is fetched once, and they work offline.
          urlPattern: ({ url }) => url.pathname.startsWith('/hc-covers/') || url.pathname.startsWith('/art-demo/'),
          handler: 'CacheFirst',
          options: { cacheName: 'covers', expiration: { maxEntries: 3000, maxAgeSeconds: 31_536_000 } },
        }],
      },
    }),
  ],
  // The same path vercel.json rewrites in production.
  server: {
    proxy: {
      '/hc-covers': { target: 'https://assets.hardcover.app', changeOrigin: true, rewrite: path => path.replace(/^\/hc-covers/, '') },
    },
  },
})
