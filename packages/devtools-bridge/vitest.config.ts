import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: '@triggery/devtools-bridge',
    include: ['__tests__/**/*.test.ts'],
    environment: 'happy-dom',
  },
});
