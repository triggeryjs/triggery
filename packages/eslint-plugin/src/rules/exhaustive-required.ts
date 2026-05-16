import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils';
import { isCreateTriggerCall } from '../utils/triggery-call.ts';

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/triggeryjs/triggery/blob/main/packages/eslint-plugin/docs/rules/${name}.md`,
);

/**
 * If a trigger declares conditions in its schema generic but no `required`
 * array, the handler must do explicit `if (!conditions.x) return` for every
 * one — easy to forget. We can't read the type generic from the AST without
 * type info, but we can warn when `required` is missing on a trigger that
 * has a non-trivial handler with `conditions.*` accesses.
 *
 * Heuristic: any `createTrigger({...})` without a `required:` key — flagged
 * with severity `suggestion`. If you genuinely want no required conditions
 * (e.g. a trigger with only events and actions, or a pure analytics
 * pipeline), add `required: []` explicitly.
 */
export const exhaustiveRequired = createRule({
  name: 'exhaustive-required',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require an explicit `required` array on every createTrigger call (use `required: []` to opt out).',
    },
    messages: {
      missing:
        'Trigger config is missing `required: [...]`. Add it explicitly so the runtime gate is unambiguous (use `required: []` if no conditions are required).',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        if (!isCreateTriggerCall(node)) return;
        const config = node.arguments[0];
        if (!config || config.type !== AST_NODE_TYPES.ObjectExpression) return;
        const hasRequired = config.properties.some(
          (p: TSESTree.ObjectLiteralElement) =>
            p.type === AST_NODE_TYPES.Property &&
            p.key.type === AST_NODE_TYPES.Identifier &&
            p.key.name === 'required',
        );
        if (!hasRequired) context.report({ node: config, messageId: 'missing' });
      },
    };
  },
});
