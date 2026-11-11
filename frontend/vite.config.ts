import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';
import { devAssetsPlugin } from './dev/dev-assets.ts';
import { mockApiPlugin } from './dev/mock-api.ts';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const distDir = fileURLToPath(new URL('../src/assets/dist', import.meta.url));

export default defineConfig({
  plugins: [
    // Preserve: AngularJS keeps every whitespace between inline elements and the stylesheet's layout
    // (button gaps, icon-to-label spacing) depends on it; Vue's default `condense` would drop it.
    vue({ template: { compilerOptions: { whitespace: 'preserve' } } }),
    mockApiPlugin(),
    devAssetsPlugin(),
  ],
  // The Yii2 asset bundle loads a plain script tag, so Vue's dev/prod switch
  // must be resolved at build time.
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: distDir,
    // The directory also holds the legacy AngularJS files; never wipe it.
    emptyOutDir: false,
    minify: true,
    // Lightning CSS minification rewrites values and drops vendor prefixes; the stylesheet must stay as authored.
    cssMinify: false,
    lib: {
      entry: fileURLToPath(new URL('./src/main.ts', import.meta.url)),
      name: 'FileManager',
      formats: ['iife'],
      fileName: () => 'filemanager.js',
      cssFileName: 'filemanager',
    },
  },
  server: { fs: { allow: [repoRoot] } },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.spec.ts'],
  },
});
