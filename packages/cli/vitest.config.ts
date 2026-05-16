import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: '@triggery/cli',
    include: ['__tests__/**/*.test.ts'],
    environment: 'node',
  },
});
