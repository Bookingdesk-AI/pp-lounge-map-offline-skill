import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const allRoutesAirportProxy = {
  target: 'https://all-routes-web.pages.dev',
  changeOrigin: true,
  rewrite: (path: string) => path.replace(/^\/api\/all-routes\/airports/, '/api/airports'),
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/all-routes/airports': allRoutesAirportProxy,
    },
  },
  preview: {
    proxy: {
      '/api/all-routes/airports': allRoutesAirportProxy,
    },
  },
});
