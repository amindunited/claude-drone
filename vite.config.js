import { defineConfig } from 'vite';
import { resolve } from 'path';

const isProd = true; // import.meta.env?.PROD;

// drone-synth.html lives in the drone-synth/ workspace, so in dev the root
// server can't serve it. Redirect to that package's dev server instead
// (start it with `npm run dev:strata`).
const droneSynthDevRedirect = {
  name: 'drone-synth-dev-redirect',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.split('?')[0] !== '/claude-drone/drone-synth.html') return next();
      res.statusCode = 302;
      res.setHeader('Location', 'http://localhost:5174/claude-drone/drone-synth.html');
      res.end();
    });
  },
};

export default defineConfig({
  plugins: [droneSynthDevRedirect],
  root: './src',
  base: isProd ? '/claude-drone/' : '/',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        original: resolve(__dirname, 'src/original.html'),
        twoLfos: resolve(__dirname, 'src/two-lfos.html'),
        tsSynth: resolve(__dirname, 'src/ts-synth.html'),
        // drone-synth.html now lives in the drone-synth/ workspace package
        // (see drone-synth/vite.config.js); its build output is copied into
        // this root dist/ by the root "build" script in package.json.
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