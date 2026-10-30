import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {defineConfig, Plugin} from 'vite';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

function spaFallbackPlugin(): Plugin {
  return {
    name: 'spa-fallback',
    closeBundle() {
      const distIndex = path.resolve(currentDir, 'dist', 'index.html');
      const dist404 = path.resolve(currentDir, 'dist', '404.html');
      if (fs.existsSync(distIndex)) {
        fs.copyFileSync(distIndex, dist404);
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), spaFallbackPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(currentDir, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
