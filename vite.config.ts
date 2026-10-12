import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { tmdbProxyMiddleware } from './server/tmdbProxy.ts';

// Dev-only implementation of the same TMDB proxy the production server runs
// (server/tmdbProxy.ts), so local development hits the exact same code path as
// the deployed app. Reads TMDB_API_KEY from the server env, never VITE_*.
function tmdbDevProxy(): Plugin {
  return {
    name: 'tmdb-dev-proxy',
    configureServer(server) {
      server.middlewares.use(tmdbProxyMiddleware());
    },
  };
}

// https://vite.dev/config/
// SPA fallback is the default behavior (appType: 'spa')
// Production deployments handle SPA routing via vercel.json / _redirects
export default defineConfig({
  plugins: [react(), tailwindcss(), tmdbDevProxy()],
  server: {
    proxy: {
      // Dev-only proxy: the 2embed catalog API doesn't send CORS headers,
      // so in dev we route through Vite to avoid browser CORS blocks.
      '/embed2': {
        target: 'https://api.2embed.cc',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/embed2/, ''),
      },
    },
  },
});
