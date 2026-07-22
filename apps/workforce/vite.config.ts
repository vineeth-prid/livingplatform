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
        name: 'Living — Workforce',
        short_name: 'Workforce',
        description: 'Get the job done. Your assigned work, on any site.',
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
        // App shell + assets precached so the app opens on a job site with no signal.
        // API reads are served from the persisted Query cache (see src/offline.ts).
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  server: { port: 5175 },
  build: { chunkSizeWarningLimit: 700 },
});
