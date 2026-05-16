import { describe } from 'vitest';
import { exhaustiveConditions } from '../src/rules/exhaustive-conditions.ts';
import { ruleTester } from './setup.ts';

describe('exhaustive-conditions', () => {
  ruleTester.run('exhaustive-conditions', exhaustiveConditions, {
    valid: [
      // All required conditions registered.
      [
        "const t = createTrigger({ id: 't', events: ['m'], required: ['user','settings'], handler() {} });",
        "function Provider() { useCondition(t, 'user', () => u); useCondition(t, 'settings', () => s); }",
      ].join('\n'),
      // No required → nothing to enforce.
      "const t = createTrigger({ id: 't', events: ['m'], required: [], handler() {} });",
    ],
    invalid: [
      {
        code: [
          "const t = createTrigger({ id: 't', events: ['m'], required: ['user','settings'], handler() {} });",
          "function Provider() { useCondition(t, 'user', () => u); }",
        ].join('\n'),
        errors: [{ messageId: 'missing', data: { trigger: 't', name: 'settings' } }],
      },
      {
        code: "const t = createTrigger({ id: 't', events: ['m'], required: ['user'], handler() {} });",
        errors: [{ messageId: 'missing', data: { trigger: 't', name: 'user' } }],
      },
    ],
  });
});
