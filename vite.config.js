import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const buildDate = new Date().toISOString().slice(0, 10);

// `base` defaults to / for local dev.
// scripts/stage-site.sh (the Pages build) sets VITE_BASE=./ so one build works at / and under pr-preview/pr-N/.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.VITE_BASE || '/',
  define: { __APP_VERSION__: JSON.stringify(version), __BUILD_DATE__: JSON.stringify(buildDate) },
  build: {
    // Inline every image as a data: URL so the release's single-file HTML works from disk.
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 2000,
  },
  server: {
    host: true,
    strictPort: true,
  },
});
