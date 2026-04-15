import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('./demo', import.meta.url));
const outDir = fileURLToPath(new URL('./demo-dist', import.meta.url));
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => ({
  root,
  base: command === 'build' ? '/port/' : '/',
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(root, 'index.html'),
        child: path.resolve(root, 'child.html')
      }
    }
  },
  resolve: {
    alias: {
      '@src': path.resolve(__dirname, 'src')
    }
  }
}));
