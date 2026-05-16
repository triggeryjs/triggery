import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';
import { getStringLiteralValue, isCreateTriggerCall } from '../utils/triggery-call.ts';

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/triggeryjs/triggery/blob/main/packages/eslint-plugin/docs/rules/${name}.md`,
);

/**
 * Trigger ids are used as keys in the runtime registry, in the inspector and
 * in devtools/Redux action labels. They MUST be string literals so that:
 *
 *   - Auto-discovery (`@triggery/vite`) can produce a stable virtual module.
 *   - The inspector and devtools UI can group runs by id deterministically.
 *   - `triggery graph` / `triggery scaffold` can detect collisions.
 */
export const noDynamicId = createRule({
  name: 'no-dynamic-id',
  meta: {
    type: 'problem',
    docs: {
      description: 'Require createTrigger({ id }) to be a string literal.',
    },
    messages: {
      dynamic:
        '`createTrigger` id must be a string literal, not a dynamic expression. The id is used as a registry key, in devtools and in graph(), and must be deterministic.',
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
        for (const prop of config.properties) {
          if (prop.type !== AST_NODE_TYPES.Property) continue;
          if (prop.key.type !== AST_NODE_TYPES.Identifier || prop.key.name !== 'id') continue;
          if (getStringLiteralValue(prop.value) === null) {
            context.report({ node: prop.value, messageId: 'dynamic' });
          }
          return;
        }
      },
    };
  },
});
