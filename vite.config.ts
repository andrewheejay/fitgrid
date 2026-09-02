import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Point the dev server's /api at a deployed one.
 *
 *   FITGRID_API_PROXY=https://fitgrid.vercel.app npm run dev
 *
 * Off by default, so `npm run dev` still needs no configuration and still
 * falls through to the browser's own reader chain. It exists because a
 * garment added locally and one added on the deployed site land in different
 * localStorage origins, and building one wardrobe out of both is worse than
 * building it once against the real endpoints.
 */
const apiProxy = process.env['FITGRID_API_PROXY'];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  ...(apiProxy
    ? { server: { proxy: { '/api': { target: apiProxy, changeOrigin: true } } } }
    : {}),
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'api/**/*.test.ts'],
  },
});
