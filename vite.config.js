import { defineConfig } from 'vite';

export default defineConfig({
  root: './src',
  base: '/',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    open: true,
    port: 5173,
  },
  css: {
    devSourcemap: true,
  },
});