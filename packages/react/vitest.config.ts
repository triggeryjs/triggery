import { defineProject } from 'vitest/config';

export default defineProject({
  resolve: {
    conditions: ['source', 'import', 'module', 'default'],
  },
  test: {
    name: '@triggery/react',
    include: ['__tests__/**/*.test.{ts,tsx}'],
    environment: 'happy-dom',
    globals: false,
  },
});
