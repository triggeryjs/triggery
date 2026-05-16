import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: '@triggery/reatom',
    include: ['__tests__/**/*.test.{ts,tsx}'],
    environment: 'happy-dom',
  },
});
