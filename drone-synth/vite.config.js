import { defineConfig } from 'vite';
import { resolve } from 'path';

const isProd = true; // import.meta.env?.PROD;

export default defineConfig({
  root: '.',
  base: isProd ? '/claude-drone/' : '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // Non-default entry name: keep the built HTML at `drone-synth.html`
        // (not Vite's default `index.html`) so the public URL is unchanged.
        droneSynth: resolve(__dirname, 'drone-synth.html'),
      },
    },
  },
  server: {
    open: true,
    port: 5174,
  },
  css: {
    devSourcemap: true,
  },
});
