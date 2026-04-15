import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts'
    },
    format: ['esm', 'iife'],
    globalName: 'CrupPort',
    splitting: false,
    sourcemap: true,
    dts: true,
    clean: true,
    outExtension({ format }) {
      return {
        js: format === 'esm' ? '.mjs' : '.global.js'
      };
    }
  },
  {
    entry: {
      child: 'src/child.ts'
    },
    format: ['esm'],
    splitting: false,
    sourcemap: true,
    dts: true,
    clean: false,
    outExtension() {
      return {
        js: '.mjs'
      };
    }
  }
]);
