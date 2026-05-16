import codspeedPlugin from '@codspeed/vitest-plugin';
import { defineProject } from 'vitest/config';

export default defineProject({
  plugins: [codspeedPlugin()],
  resolve: {
    conditions: ['source', 'import', 'module', 'default'],
  },
  test: {
    name: 'benchmarks',
    include: ['bench/**/*.bench.ts'],
    environment: 'node',
    benchmark: {
      include: ['bench/**/*.bench.ts'],
    },
  },
});
