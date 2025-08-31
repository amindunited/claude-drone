import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: './src',
  base: '/',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        original: resolve(__dirname, 'src/original.html'),
        twoLfos: resolve(__dirname, 'src/two-lfos.html'),
        // about: resolve(__dirname, 'src/about.html'),
        // contact: resolve(__dirname, 'src/contact.html'),
        // Add more pages here as needed
        // dashboard: resolve(__dirname, 'src/dashboard.html'),
        // login: resolve(__dirname, 'src/login.html'),
      },
    },
  },
  server: {
    open: true,
    port: 5173,
  },
  css: {
    devSourcemap: true,
  },
});