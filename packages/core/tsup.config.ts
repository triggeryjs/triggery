import { defineConfig } from 'tsup';

// Two builds:
//   - default (`dist/index.js`, `dist/inspect.js`) — DEV warnings intact;
//     downstream bundlers configured with `process.env.NODE_ENV === 'production'`
//     dead-code-eliminate them during minify.
//   - production (`dist/index.prod.js`, `dist/inspect.prod.js`) — DEV blocks
//     stripped at our build time via `define`. Picked by the `"production"`
//     export condition.
export default defineConfig([
  {
    entry: ['src/index.ts', 'src/inspect.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2022',
    treeshake: true,
    splitting: false,
    minify: false,
  },
  {
    entry: { 'index.prod': 'src/index.ts', 'inspect.prod': 'src/inspect.ts' },
    format: ['esm'],
    dts: false,
    sourcemap: false,
    clean: false,
    target: 'es2022',
    treeshake: true,
    splitting: false,
    minify: false,
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  },
]);
