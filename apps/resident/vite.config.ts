import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Living — Resident',
        short_name: 'Living',
        description: 'Life Happens Here. Your community, in one calm app.',
        theme_color: '#234b39',
        background_color: '#faf8f4',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // App shell + assets precached; API calls stay network-first via Query.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  server: { port: 5174 },
  // The resident PWA is a single precached bundle (offline-first); ~200 kB gzip.
  build: { chunkSizeWarningLimit: 800 },
});
