import { describe } from 'vitest';
import { noNonNullAssertionInHandler } from '../src/rules/no-non-null-assertion-in-handler.ts';
import { ruleTester } from './setup.ts';

describe('no-non-null-assertion-in-handler', () => {
  ruleTester.run('no-non-null-assertion-in-handler', noNonNullAssertionInHandler, {
    valid: [
      // No `!` in the handler — fine.
      `const t = createTrigger({
         id: 'x', events: ['e'], required: ['user'],
         handler({ conditions }) { if (!conditions.user) return; return conditions.user.id; }
       });`,
      // `!` on something other than conditions — out of scope for this rule.
      `const t = createTrigger({
         id: 'x', events: ['e'],
         handler({ event }) { return event!.payload; }
       });`,
      // `!` outside any handler — out of scope.
      `const x = obj.field!;`,
    ],
    invalid: [
      {
        code: `const t = createTrigger({
                 id: 'x', events: ['e'], required: ['user'],
                 handler({ conditions }) { return conditions.user!.id; }
               });`,
        errors: [{ messageId: 'assertion', data: { name: 'user' } }],
        output: `const t = createTrigger({
                 id: 'x', events: ['e'], required: ['user'],
                 handler({ conditions }) { return conditions.user.id; }
               });`,
      },
      {
        code: `const t = createTrigger({
                 id: 'x', events: ['e'], required: ['user', 'settings'],
                 handler: ({ conditions }) => {
                   const u = conditions.user!;
                   const s = conditions.settings!;
                   return { u, s };
                 },
               });`,
        errors: [
          { messageId: 'assertion', data: { name: 'user' } },
          { messageId: 'assertion', data: { name: 'settings' } },
        ],
        output: `const t = createTrigger({
                 id: 'x', events: ['e'], required: ['user', 'settings'],
                 handler: ({ conditions }) => {
                   const u = conditions.user;
                   const s = conditions.settings;
                   return { u, s };
                 },
               });`,
      },
    ],
  });
});
