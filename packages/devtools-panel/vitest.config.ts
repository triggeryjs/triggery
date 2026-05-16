import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: '@triggery/devtools-panel',
    include: ['__tests__/**/*.test.tsx'],
    environment: 'happy-dom',
  },
});
