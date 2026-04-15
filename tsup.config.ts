import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts'
    },
    format: ['esm'],
    splitting: false,
    dts: true,
    clean: true,
    outExtension() {
      return {
        js: '.mjs'
      };
    }
  },
  {
    entry: {
      child: 'src/child.ts'
    },
    format: ['esm'],
    splitting: false,
    dts: true,
    clean: false,
    outExtension() {
      return {
        js: '.mjs'
      };
    }
  }
]);
