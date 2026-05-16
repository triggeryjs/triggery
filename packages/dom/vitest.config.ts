import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: '@triggery/dom',
    include: ['__tests__/**/*.test.{ts,tsx}'],
    environment: 'happy-dom',
  },
});
