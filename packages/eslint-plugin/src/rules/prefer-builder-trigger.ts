import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils';
import { isCreateTriggerCall } from '../utils/triggery-call.ts';

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/triggeryjs/triggery/blob/main/packages/eslint-plugin/docs/rules/${name}.md`,
);

/**
 * Flag `createTrigger({ required: [...], ... })` configurations and suggest
 * rewriting them in the v0.10 builder form
 * `createTrigger<S>().require(...).handle(...)`. The builder narrows
 * `conditions.<key>` to `NonNullable<...>` automatically.
 *
 * Off in the `recommended` preset, on in `strict`. Suggestion only — autofix
 * is not provided because moving from object-config to a chain involves a
 * non-trivial rewrite that the @triggery/codemod handles better at scale.
 */
export const preferBuilderTrigger = createRule({
  name: 'prefer-builder-trigger',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Suggest the v0.10 builder API (`createTrigger<S>().require(...).handle(...)`) when `required: [...]` is used in the imperative form.',
    },
    messages: {
      preferBuilder:
        '`createTrigger({ required: [{{required}}] })` could be written as `createTrigger<S>().require({{required}}).handle(...)`. The builder form narrows `conditions.<key>` to NonNullable<...> automatically — drop the `!` non-null assertions and early-return guards.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node: TSESTree.CallExpression) {
        if (!isCreateTriggerCall(node)) return;
        const config = node.arguments[0];
        if (!config || config.type !== AST_NODE_TYPES.ObjectExpression) return;
        for (const prop of config.properties) {
          if (prop.type !== AST_NODE_TYPES.Property) continue;
          if (prop.key.type !== AST_NODE_TYPES.Identifier || prop.key.name !== 'required') continue;
          const value = prop.value;
          if (value.type !== AST_NODE_TYPES.ArrayExpression) return;
          if (value.elements.length === 0) return;
          const required = value.elements
            .filter((el): el is TSESTree.Literal => el?.type === AST_NODE_TYPES.Literal)
            .map((el) => `'${String(el.value)}'`)
            .join(', ');
          context.report({
            node: prop,
            messageId: 'preferBuilder',
            data: { required },
          });
          return;
        }
      },
    };
  },
});
