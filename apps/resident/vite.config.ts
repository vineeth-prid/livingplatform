import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        // `id` pins the app identity — without it a start_url change makes the
        // browser treat this as a different app and the install is orphaned.
        id: '/',
        name: 'Living — Resident',
        short_name: 'Living',
        description: 'Life Happens Here. Your community, in one calm app.',
        theme_color: '#234b39',
        background_color: '#faf8f4',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'en',
        categories: ['lifestyle', 'productivity'],
        icons: [
          // Chrome requires a raster icon ≥192px to consider the app
          // installable; the SVG alone is not enough. Keep both — the SVG is
          // the crisp favicon, the PNGs satisfy install criteria + splash.
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
        shortcuts: [
          { name: 'Pay maintenance', url: '/maintenance', description: 'View and pay your dues' },
          { name: 'Invite a visitor', url: '/visitors', description: 'Create a gate pass' },
        ],
      },
      workbox: {
        // App shell + assets precached; API calls stay network-first via Query.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
      },
      devOptions: {
        // Lets the install prompt and service worker be exercised in `vite dev`.
        enabled: true,
        type: 'module',
      },
    }),
  ],
  server: { port: 5174 },
  // The resident PWA is a single precached bundle (offline-first); ~200 kB gzip.
  build: { chunkSizeWarningLimit: 800 },
});
