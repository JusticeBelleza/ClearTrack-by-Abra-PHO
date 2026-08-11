// vite.config.ts
import { defineConfig } from 'vitest/config'; 
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'clear_track_logo.png'],
      manifest: {
        name: 'filetrackr',
        short_name: 'filetrackr',
        description: 'Document Routing System for Abra PHO',
        theme_color: '#ffffff',
        background_color: '#0B1120',
        display: 'standalone', // This makes it look like a native app (no browser UI)
        icons: [
          {
            src: 'clear_track_logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'clear_track_logo.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'clear_track_logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['**/e2e/**', '**/node_modules/**'],
    // Injects dummy variables so Zod validation passes during CI/CD test runs
    env: {
      VITE_SUPABASE_URL: 'https://test-dummy.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-dummy-anon-key',
      VITE_SUPABASE_SERVICE_ROLE_KEY: 'test-dummy-service-key',
      VITE_TURNSTILE_SITE_KEY: '1x00000000000000000000AA'
    }
  },
});