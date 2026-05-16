import { describe } from 'vitest';
import { maxHandlerSize } from '../src/rules/max-handler-size.ts';
import { ruleTester } from './setup.ts';

describe('max-handler-size', () => {
  ruleTester.run('max-handler-size', maxHandlerSize, {
    valid: [
      "const t = createTrigger({ id: 't', events: ['m'], handler() { const a = 1; const b = 2; } });",
    ],
    invalid: [
      {
        options: [{ max: 3 }],
        code: [
          "const t = createTrigger({ id: 't', events: ['m'], handler() {",
          '  const a = 1;',
          '  const b = 2;',
          '  const c = 3;',
          '  const d = 4;',
          '} });',
        ].join('\n'),
        errors: [{ messageId: 'tooLarge', data: { count: 4, max: 3 } }],
      },
    ],
  });
});
