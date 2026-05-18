import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils';
import { isCreateTriggerCall } from '../utils/triggery-call.ts';

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/triggeryjs/triggery/blob/main/packages/eslint-plugin/docs/rules/${name}.md`,
);

/**
 * Flag `conditions.X!` non-null assertions inside a trigger handler. In v0.10
 * the builder API (`createTrigger<S>().require('X').handle(...)`) narrows
 * `conditions.X` to `NonNullable<...>` automatically, so the assertion is
 * unnecessary noise. The autofix removes the `!`.
 *
 * The rule is also valuable for the imperative form (`createTrigger({ required: ['X'], ... })`):
 * once the user adds an early-return guard (`if (!conditions.X) return;`) TS
 * narrows the value, and the `!` becomes redundant.
 */
export const noNonNullAssertionInHandler = createRule({
  name: 'no-non-null-assertion-in-handler',
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description:
        'Flag `conditions.X!` inside a trigger handler — prefer the v0.10 builder API which narrows required conditions automatically.',
    },
    messages: {
      assertion:
        '`conditions.{{name}}!` is unnecessary inside a trigger handler. Use the v0.10 builder API (`import { createTrigger } from "@triggery/core/builder"`; then `createTrigger<S>().require("{{name}}").handle(...)`) so the type is narrowed automatically, or guard with `if (!conditions.{{name}}) return;`.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    // Track AST nodes for handler functions of createTrigger calls so we can
    // tell whether a `conditions.X!` expression lives inside one.
    const handlerStack: TSESTree.Node[] = [];

    const enterHandlerIfTriggerCall = (node: TSESTree.CallExpression) => {
      if (!isCreateTriggerCall(node)) return;
      const config = node.arguments[0];
      if (!config || config.type !== AST_NODE_TYPES.ObjectExpression) return;
      for (const prop of config.properties) {
        if (prop.type !== AST_NODE_TYPES.Property) continue;
        if (prop.key.type !== AST_NODE_TYPES.Identifier) continue;
        if (prop.key.name !== 'handler') continue;
        if (
          prop.value.type === AST_NODE_TYPES.ArrowFunctionExpression ||
          prop.value.type === AST_NODE_TYPES.FunctionExpression
        ) {
          handlerStack.push(prop.value);
        }
        return;
      }
    };

    const exitNodeIfHandler = (node: TSESTree.Node) => {
      if (handlerStack.length > 0 && handlerStack[handlerStack.length - 1] === node) {
        handlerStack.pop();
      }
    };

    return {
      CallExpression: enterHandlerIfTriggerCall,
      'ArrowFunctionExpression:exit': exitNodeIfHandler,
      'FunctionExpression:exit': exitNodeIfHandler,

      TSNonNullExpression(node: TSESTree.TSNonNullExpression) {
        if (handlerStack.length === 0) return;
        const inner = node.expression;
        // Match `conditions.<name>!` — direct member access through the
        // `conditions` identifier. Nested chains (`conditions.user!.id`) get
        // their warning on the outermost `!`.
        if (inner.type !== AST_NODE_TYPES.MemberExpression) return;
        const obj = inner.object;
        if (obj.type !== AST_NODE_TYPES.Identifier || obj.name !== 'conditions') return;
        if (inner.property.type !== AST_NODE_TYPES.Identifier) return;
        context.report({
          node,
          messageId: 'assertion',
          data: { name: inner.property.name },
          fix(fixer) {
            // Drop the trailing `!` token. The TSNonNullExpression node's
            // range covers `inner!`; the trailing exclamation lives between
            // inner.range[1] and node.range[1].
            return fixer.removeRange([inner.range[1], node.range[1]]);
          },
        });
      },
    };
  },
});
