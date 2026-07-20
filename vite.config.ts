import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'FindParker',
        short_name: 'FindParker',
        description: 'Coordinate volunteer search-and-rescue in the field.',
        theme_color: '#0b3d2e',
        background_color: '#0b3d2e',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    globals: true,
    // Playwright's own specs live under tests/e2e and run via `npm run test:e2e`, not vitest.
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
});
