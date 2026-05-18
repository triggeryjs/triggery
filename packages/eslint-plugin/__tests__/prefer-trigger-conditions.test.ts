import { describe } from 'vitest';
import { preferTriggerConditions } from '../src/rules/prefer-trigger-conditions.ts';
import { ruleTester } from './setup.ts';

describe('prefer-trigger-conditions', () => {
  ruleTester.run('prefer-trigger-conditions', preferTriggerConditions, {
    valid: [
      // Complex getter — out of scope (codemod will skip too).
      "runtime.registerCondition(t.id, 'user', () => store.getUser());",
      // Function-call getter with args — out of scope.
      "runtime.registerCondition(t.id, 'user', () => userRef.current);",
      // Not registerCondition.
      "runtime.registerAction(t.id, 'foo', () => bar);",
    ],
    invalid: [
      {
        code: "runtime.registerCondition(t.id, 'user', () => currentUser);",
        errors: [{ messageId: 'preferConditions' }],
      },
      {
        code: "runtime.registerCondition(messageTrigger.id, 'settings', () => settings);",
        errors: [{ messageId: 'preferConditions' }],
      },
    ],
  });
});
