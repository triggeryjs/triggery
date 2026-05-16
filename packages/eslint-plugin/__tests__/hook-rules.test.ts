import { describe } from 'vitest';
import { hookRules } from '../src/rules/hook-rules.ts';
import { ruleTester } from './setup.ts';

describe('hook-rules', () => {
  ruleTester.run('hook-rules', hookRules, {
    valid: [
      "function Chat() { useEvent(t, 'm'); }",
      "function useMessage() { useEvent(t, 'm'); }",
      "const Chat = () => { useEvent(t, 'm'); };",
      "const useMessage = () => useEvent(t, 'm');",
    ],
    invalid: [
      {
        // Plain function — not a component, not a hook.
        code: "function helper() { useEvent(t, 'm'); }",
        errors: [{ messageId: 'outside', data: { hook: 'useEvent' } }],
      },
      {
        // Module scope.
        code: "useEvent(t, 'm');",
        errors: [{ messageId: 'outside', data: { hook: 'useEvent' } }],
      },
    ],
  });
});
