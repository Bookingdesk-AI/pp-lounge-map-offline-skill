import fs from 'node:fs/promises';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const allRoutesAirportProxy = {
  target: 'https://all-routes-web.pages.dev',
  changeOrigin: true,
  rewrite: (path: string) => path.replace(/^\/api\/all-routes\/airports/, '/api/airports'),
};

const publicBuildFiles = [
  '_headers',
  '_redirects',
  'favicon.ico',
  'favicon.svg',
  'icon.svg',
  'preview-card.png',
  'preview-card-20260722.png',
  'preview-card.svg',
  'data/lounge-map.json',
];

function productionPublicAssets() {
  return {
    name: 'lounge-guru-production-public-assets',
    apply: 'build' as const,
    async closeBundle() {
      const publicRoot = path.resolve('public');
      const distRoot = path.resolve('dist');

      await Promise.all(
        publicBuildFiles.map(async (relativePath) => {
          const sourcePath = path.join(publicRoot, relativePath);
          const destinationPath = path.join(distRoot, relativePath);
          await fs.mkdir(path.dirname(destinationPath), { recursive: true });
          await fs.copyFile(sourcePath, destinationPath);
        }),
      );
      await fs.cp(path.join(publicRoot, 'data', 'brand-logos'), path.join(distRoot, 'data', 'brand-logos'), {
        recursive: true,
      });
      await fs.cp(path.join(publicRoot, 'fonts'), path.join(distRoot, 'fonts'), { recursive: true });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  publicDir: command === 'build' ? false : 'public',
  plugins: [react(), productionPublicAssets()],
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
}));
