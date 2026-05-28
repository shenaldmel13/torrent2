import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

// Custom Vite plugin to enforce correct MIME types for JavaScript files
const mimeTypeFormatter = (): Plugin => ({
  name: 'mime-type-formatter',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url) {
        const urlPath = req.url.split('?')[0];
        if (urlPath.endsWith('.js') || urlPath.endsWith('.mjs')) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.setHeader('X-Content-Type-Options', 'nosniff');
        } else if (urlPath.endsWith('.css')) {
          res.setHeader('Content-Type', 'text/css; charset=utf-8');
          res.setHeader('X-Content-Type-Options', 'nosniff');
        }
      }
      next();
    });
  }
});

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), mimeTypeFormatter()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
