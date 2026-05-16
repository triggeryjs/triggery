import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils';
import { isCreateTriggerCall } from '../utils/triggery-call.ts';

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/triggeryjs/triggery/blob/main/packages/eslint-plugin/docs/rules/${name}.md`,
);

/**
 * Limits the size of a trigger's `handler` body. A 200-line handler is a
 * smell: the file no longer reads like a spec. The escape hatch is the
 * `extract-trigger` codemod (decompose into sub-triggers) or a refactor of
 * actions into smaller, more focused ones.
 *
 * The rule counts top-level statements in the handler body, not characters
 * or AST nodes — matches the way humans skim code.
 */
export const maxHandlerSize = createRule<[{ max?: number }], 'tooLarge'>({
  name: 'max-handler-size',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Limit the size of a trigger handler body (default 50 statements).',
    },
    messages: {
      tooLarge:
        'Trigger handler has {{count}} top-level statements, which exceeds the limit of {{max}}. Consider splitting it (see the `extract-trigger` codemod) or moving logic into smaller actions.',
    },
    schema: [
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          max: { type: 'integer', minimum: 1 },
        },
      },
    ],
  },
  defaultOptions: [{ max: 50 }],
  create(context, [options]) {
    const max = options.max ?? 50;
    return {
      CallExpression(node) {
        if (!isCreateTriggerCall(node)) return;
        const config = node.arguments[0];
        if (!config || config.type !== AST_NODE_TYPES.ObjectExpression) return;
        for (const prop of config.properties) {
          if (prop.type !== AST_NODE_TYPES.Property) continue;
          if (prop.key.type !== AST_NODE_TYPES.Identifier || prop.key.name !== 'handler') continue;
          const handler = prop.value;
          let body: TSESTree.BlockStatement | null = null;
          if (
            handler.type === AST_NODE_TYPES.FunctionExpression ||
            handler.type === AST_NODE_TYPES.ArrowFunctionExpression
          ) {
            if (handler.body.type === AST_NODE_TYPES.BlockStatement) body = handler.body;
          }
          if (!body) return;
          const count = body.body.length;
          if (count > max) {
            context.report({
              node: handler,
              messageId: 'tooLarge',
              data: { count, max },
            });
          }
          return;
        }
      },
    };
  },
});
