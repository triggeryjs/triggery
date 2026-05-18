import { describe } from 'vitest';
import { preferActionChannel } from '../src/rules/prefer-action-channel.ts';
import { ruleTester } from './setup.ts';

describe('prefer-action-channel', () => {
  ruleTester.run('prefer-action-channel', preferActionChannel, {
    valid: [
      // Direct registration without fan-out — fine.
      "runtime.registerAction(t.id, 'log', (p) => console.log(p));",
      // For-of present but it's a registerCondition call — not our concern.
      "runtime.registerCondition(t.id, 'x', () => { for (const a of arr) {} });",
      // Block-less arrow — no fan-out.
      "runtime.registerAction(t.id, 'log', (p) => doStuff(p));",
    ],
    invalid: [
      {
        code: "runtime.registerAction(t.id, 'showToast', (p) => { for (const cb of subs) cb(p); });",
        errors: [{ messageId: 'preferChannel', data: { name: 'showToast' } }],
      },
      {
        code: "runtime.registerAction(t.id, 'badge', function(p) { for (const fn of listeners) fn(p); });",
        errors: [{ messageId: 'preferChannel', data: { name: 'badge' } }],
      },
    ],
  });
});
