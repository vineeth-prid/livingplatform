import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    target: 'es2022',
    // The app core (React + eagerly-loaded foundation routes) gzips to ~183 kB;
    // feature routes are lazy-split. 700 kB flags a real regression above that.
    chunkSizeWarningLimit: 700,
    // Route-level code splitting comes from lazy routes; keep vendor chunks lean.
    rollupOptions: {
      output: {
        manualChunks: {
          router: ['@tanstack/react-router'],
          query: ['@tanstack/react-query'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});
