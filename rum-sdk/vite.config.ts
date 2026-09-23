import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'RicozRum',
      formats: ['es', 'umd', 'iife'],
      fileName: (format) => {
        if (format === 'iife') return 'ricoz-rum.min.js';
        if (format === 'umd') return 'ricoz-rum.umd.js';
        if (format === 'es') return 'ricoz-rum.esm.js';
        return `ricoz-rum.${format}.js`;
      }
    },
    minify: 'esbuild',
    sourcemap: true,
    emptyOutDir: true
  }
});
