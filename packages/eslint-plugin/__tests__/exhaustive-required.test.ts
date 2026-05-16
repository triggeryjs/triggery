import { describe } from 'vitest';
import { exhaustiveRequired } from '../src/rules/exhaustive-required.ts';
import { ruleTester } from './setup.ts';

describe('exhaustive-required', () => {
  ruleTester.run('exhaustive-required', exhaustiveRequired, {
    valid: [
      "const t = createTrigger({ id: 't', events: ['m'], required: [], handler() {} });",
      "const t = createTrigger({ id: 't', events: ['m'], required: ['x'], handler() {} });",
    ],
    invalid: [
      {
        code: "const t = createTrigger({ id: 't', events: ['m'], handler() {} });",
        errors: [{ messageId: 'missing' }],
      },
    ],
  });
});
