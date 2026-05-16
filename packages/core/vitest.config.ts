import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: '@triggery/core',
    include: ['__tests__/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/types.ts', 'src/index.ts'],
      // Roadmap §17 specifies ≥ 95% lines on the hot dispatch path. We pin
      // lines/statements/functions to that bar. Branches sit at ≥ 85% — a
      // few env-specific DEV warnings, the NODE_ENV=production branch and
      // the StrictMode double-mount empty-stack branch are legitimately
      // hard to drive from a unit test without forking the runtime, so the
      // branch bar is one step below.
      thresholds: {
        lines: 95,
        statements: 95,
        functions: 95,
        branches: 85,
      },
    },
  },
});
