import { describe } from 'vitest';
import { preferBuilderTrigger } from '../src/rules/prefer-builder-trigger.ts';
import { ruleTester } from './setup.ts';

describe('prefer-builder-trigger', () => {
  ruleTester.run('prefer-builder-trigger', preferBuilderTrigger, {
    valid: [
      // No required → no suggestion.
      "const t = createTrigger({ id: 'x', events: ['e'], handler() {} });",
      // Empty required → no suggestion.
      "const t = createTrigger({ id: 'x', events: ['e'], required: [], handler() {} });",
      // Builder form is already used (no second-arg call here).
      "const t = createTrigger().id('x').events(['e']).require('a').handle(() => {});",
    ],
    invalid: [
      {
        code: "const t = createTrigger({ id: 'x', events: ['e'], required: ['user'], handler() {} });",
        errors: [{ messageId: 'preferBuilder' }],
      },
      {
        code: "const t = createTrigger({ id: 'x', events: ['e'], required: ['a', 'b'], handler() {} });",
        errors: [{ messageId: 'preferBuilder' }],
      },
    ],
  });
});
