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
      // Tell Vite to include these specific files in the build
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'FileTrackr',
        short_name: 'FileTrackr',
        description: 'Document Routing System for Abra PHO',
        theme_color: '#0B1120',
        background_color: '#ffffff',
        display: 'standalone', 
        icons: [
          {
            src: '/pwa-192x192.png', // Uses your specific 192px image
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png', // Uses your specific 512px image
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable' // Helps Android wrap it in circles/squares dynamically
          }
        ]
      }
    })
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['**/e2e/**', '**/node_modules/**'],
    env: {
      VITE_SUPABASE_URL: 'https://test-dummy.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-dummy-anon-key',
      VITE_SUPABASE_SERVICE_ROLE_KEY: 'test-dummy-service-key',
      VITE_TURNSTILE_SITE_KEY: '1x00000000000000000000AA'
    }
  },
});