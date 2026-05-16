import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: '@triggery/mobx',
    include: ['__tests__/**/*.test.{ts,tsx}'],
    environment: 'happy-dom',
  },
});
