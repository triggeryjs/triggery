import { describe } from 'vitest';
import { maxPortsPerTrigger } from '../src/rules/max-ports-per-trigger.ts';
import { ruleTester } from './setup.ts';

describe('max-ports-per-trigger', () => {
  ruleTester.run('max-ports-per-trigger', maxPortsPerTrigger, {
    valid: [
      "const t = createTrigger({ id: 't', events: ['a','b'], required: ['x','y'], handler() {} });",
    ],
    invalid: [
      {
        options: [{ maxEvents: 2, maxConditions: 2, maxTotal: 3 }],
        code: "const t = createTrigger({ id: 't', events: ['a','b','c','d'], required: ['x','y','z'], handler() {} });",
        errors: [
          { messageId: 'tooManyEvents' },
          { messageId: 'tooManyConditions' },
          { messageId: 'tooManyTotal' },
        ],
      },
    ],
  });
});
