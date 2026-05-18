import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/triggeryjs/triggery/blob/main/packages/eslint-plugin/docs/rules/${name}.md`,
);

/**
 * Flag `runtime.registerCondition(t.id, 'name', () => varName)` patterns that
 * look like they could be moved into the trigger's inline `conditions:` config
 * (v0.10+). Heuristic: getter is `() => <localIdentifier>` and the source
 * file declares that identifier as `let`. Suggestion only — the codemod
 * (`migrate-to-v010`) performs the actual rewrite.
 */
export const preferTriggerConditions = createRule({
  name: 'prefer-trigger-conditions',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        "Suggest moving `runtime.registerCondition(t.id, name, () => varName)` into the trigger's `conditions:` config when the getter trivially reads a local `let` binding.",
    },
    messages: {
      preferConditions:
        '`runtime.registerCondition` with a trivial getter `() => {{binding}}` could be expressed as `createTrigger({ conditions: { {{name}}: {{binding}} } })` (v0.10+). Update the value with `trigger.setCondition("{{name}}", newValue)`.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node: TSESTree.CallExpression) {
        const callee = node.callee;
        if (
          callee.type !== AST_NODE_TYPES.MemberExpression ||
          callee.property.type !== AST_NODE_TYPES.Identifier ||
          callee.property.name !== 'registerCondition'
        ) {
          return;
        }
        const [, nameLit, getterArg] = node.arguments;
        if (
          !nameLit ||
          nameLit.type !== AST_NODE_TYPES.Literal ||
          typeof nameLit.value !== 'string'
        ) {
          return;
        }
        if (!getterArg) return;
        if (getterArg.type !== AST_NODE_TYPES.ArrowFunctionExpression) return;
        if (getterArg.params.length !== 0) return;
        const body = getterArg.body;
        if (body.type !== AST_NODE_TYPES.Identifier) return; // require `() => varName` shape
        context.report({
          node,
          messageId: 'preferConditions',
          data: { name: nameLit.value, binding: body.name },
        });
      },
    };
  },
});
