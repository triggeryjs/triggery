import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils';
import { isCreateTriggerCall } from '../utils/triggery-call.ts';

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/triggeryjs/triggery/blob/main/packages/eslint-plugin/docs/rules/${name}.md`,
);

/**
 * A trigger with 15 events × 12 conditions × 8 actions is a god-trigger.
 * The "scenario reads like a spec" property is lost.
 *
 * We approximate the port count from the runtime-visible config:
 *
 *   - `events`         — count of strings in the array
 *   - `required`       — count of strings in the array
 *   - + the generic schema's `actions` keys we can see (TypeScript type
 *     args aren't AST-visible without type info; we count what's in the
 *     config instead, which is a fair lower bound).
 *
 * Configurable per-port via options: { maxEvents, maxConditions, maxTotal }.
 */
export const maxPortsPerTrigger = createRule<
  [{ maxEvents?: number; maxConditions?: number; maxTotal?: number }],
  'tooManyTotal' | 'tooManyEvents' | 'tooManyConditions'
>({
  name: 'max-ports-per-trigger',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Cap the number of events / required-conditions per trigger to keep scenarios spec-like.',
    },
    messages: {
      tooManyTotal:
        'Trigger has {{count}} ports declared in its config (limit: {{max}}). Consider splitting it.',
      tooManyEvents:
        'Trigger lists {{count}} events (limit: {{max}}). Split scenarios that fire on different events.',
      tooManyConditions:
        'Trigger requires {{count}} conditions (limit: {{max}}). Consider whether all are truly required, or move some to opt-in checks via `check.is()`.',
    },
    schema: [
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          maxEvents: { type: 'integer', minimum: 1 },
          maxConditions: { type: 'integer', minimum: 1 },
          maxTotal: { type: 'integer', minimum: 1 },
        },
      },
    ],
  },
  defaultOptions: [{ maxEvents: 8, maxConditions: 8, maxTotal: 12 }],
  create(context, [options]) {
    const maxEvents = options.maxEvents ?? 8;
    const maxConditions = options.maxConditions ?? 8;
    const maxTotal = options.maxTotal ?? 12;

    function countStringArrayProp(config: TSESTree.ObjectExpression, propName: string): number {
      const prop = config.properties.find(
        (p): p is TSESTree.Property =>
          p.type === AST_NODE_TYPES.Property &&
          p.key.type === AST_NODE_TYPES.Identifier &&
          p.key.name === propName,
      );
      if (!prop) return 0;
      if (prop.value.type !== AST_NODE_TYPES.ArrayExpression) return 0;
      return prop.value.elements.length;
    }

    return {
      CallExpression(node) {
        if (!isCreateTriggerCall(node)) return;
        const config = node.arguments[0];
        if (!config || config.type !== AST_NODE_TYPES.ObjectExpression) return;
        const events = countStringArrayProp(config, 'events');
        const required = countStringArrayProp(config, 'required');
        const total = events + required;

        if (events > maxEvents) {
          context.report({
            node: config,
            messageId: 'tooManyEvents',
            data: { count: events, max: maxEvents },
          });
        }
        if (required > maxConditions) {
          context.report({
            node: config,
            messageId: 'tooManyConditions',
            data: { count: required, max: maxConditions },
          });
        }
        if (total > maxTotal) {
          context.report({
            node: config,
            messageId: 'tooManyTotal',
            data: { count: total, max: maxTotal },
          });
        }
      },
    };
  },
});
