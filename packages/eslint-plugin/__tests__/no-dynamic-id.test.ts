import { describe } from 'vitest';
import { noDynamicId } from '../src/rules/no-dynamic-id.ts';
import { ruleTester } from './setup.ts';

describe('no-dynamic-id', () => {
  ruleTester.run('no-dynamic-id', noDynamicId, {
    valid: [
      "const t = createTrigger({ id: 'message-received', events: ['m'], handler() {} });",
      'const t = createTrigger({ id: `pure-template`, events: [], handler() {} });',
    ],
    invalid: [
      {
        code: 'const t = createTrigger({ id: someVar, events: [], handler() {} });',
        errors: [{ messageId: 'dynamic' }],
      },
      {
        // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional fixture — the rule must flag template-literal interpolation in `id`
        code: 'const t = createTrigger({ id: `dynamic-${suffix}`, events: [], handler() {} });',
        errors: [{ messageId: 'dynamic' }],
      },
    ],
  });
});
