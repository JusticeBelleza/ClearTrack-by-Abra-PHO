// vite.config.ts
import { defineConfig } from 'vitest/config'; 
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['**/e2e/**', '**/node_modules/**'],
    // Injects dummy variables so Zod validation passes during CI/CD test runs
    env: {
      VITE_SUPABASE_URL: 'https://test-dummy.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-dummy-anon-key',
      VITE_SUPABASE_SERVICE_ROLE_KEY: 'test-dummy-service-key', // <-- Added missing comma here
      VITE_TURNSTILE_SITE_KEY: '1x00000000000000000000AA'
    }
  },
});