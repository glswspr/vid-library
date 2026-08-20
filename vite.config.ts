import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
// SPA fallback is the default behavior (appType: 'spa')
// Production deployments handle SPA routing via vercel.json / _redirects
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
