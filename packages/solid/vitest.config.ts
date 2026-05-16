import solidPlugin from 'vite-plugin-solid';
import { defineProject } from 'vitest/config';

export default defineProject({
  plugins: [solidPlugin()],
  test: {
    name: '@triggery/solid',
    include: ['__tests__/**/*.test.{ts,tsx}'],
    environment: 'happy-dom',
    // `@solidjs/testing-library` re-exports its own renderer; no setup file needed.
    server: {
      deps: {
        // Solid's testing-library bundles the runtime; without this, two copies
        // of solid-js can end up in the module graph during tests and break
        // reactivity assertions.
        inline: [/solid-js/, /@solidjs\/testing-library/],
      },
    },
  },
  resolve: {
    conditions: ['development', 'browser'],
  },
});
