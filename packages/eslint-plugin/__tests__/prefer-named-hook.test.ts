import { describe } from 'vitest';
import { preferNamedHook } from '../src/rules/prefer-named-hook.ts';
import { ruleTester } from './setup.ts';

describe('prefer-named-hook', () => {
  ruleTester.run('prefer-named-hook', preferNamedHook, {
    valid: [
      // Below threshold (default = 4 port calls per file).
      "function A() { useEvent(t, 'a'); useEvent(t, 'b'); useCondition(t, 'c', () => x); }",
    ],
    invalid: [
      {
        code: [
          'function A() {',
          "  useEvent(t, 'new-message');",
          "  useEvent(t, 'reset');",
          "  useCondition(t, 'user', () => u);",
          "  useAction(t, 'show-toast', () => {});",
          '}',
        ].join('\n'),
        errors: [
          { messageId: 'prefer' },
          { messageId: 'prefer' },
          { messageId: 'prefer' },
          { messageId: 'prefer' },
        ],
      },
    ],
  });
});
