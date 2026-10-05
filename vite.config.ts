import { defineConfig } from 'vite';

// The app lives in app/.
export default defineConfig({
  root: 'app',
  build: { outDir: '../dist', emptyOutDir: true },
});
