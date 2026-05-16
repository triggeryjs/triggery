import { describe } from 'vitest';
import { noEventCascade } from '../src/rules/no-event-cascade.ts';
import { ruleTester } from './setup.ts';

describe('no-event-cascade', () => {
  ruleTester.run('no-event-cascade', noEventCascade, {
    valid: [
      // useEvent outside useAction — allowed.
      "function Chat() { const fire = useEvent(t, 'msg'); fire(1); }",
      // useAction without internal useEvent.
      "function Chat() { useAction(t, 'show', (p) => toast(p)); }",
      // Calling a previously captured fire fn inside useAction is *not* covered
      // by the file-local heuristic (variable-tracking is out of scope here).
      "function Chat() { const fire = useEvent(t, 'msg'); useAction(t, 'show', () => fire(1)); }",
    ],
    invalid: [
      {
        code: "function Chat() { useAction(t, 'show', () => { useEvent(other, 'next'); }); }",
        errors: [{ messageId: 'cascade' }],
      },
      {
        code: "function Chat() { useAction(t, 'a', function() { useEvent(t2, 'b'); }); }",
        errors: [{ messageId: 'cascade' }],
      },
    ],
  });
});
