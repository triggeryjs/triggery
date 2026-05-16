import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/triggeryjs/triggery/blob/main/packages/eslint-plugin/docs/rules/${name}.md`,
);

/**
 * Calling `useEvent(...)` inside a `useAction(...)` handler creates an
 * implicit "action → fireEvent" cascade. Runtime allows cascades up to
 * `maxCascadeDepth` (default 3), but in source they should be explicit,
 * because debugging a hidden cascade across files is painful.
 *
 * If a cascade is *intentional*, the recommended pattern is to expose the
 * downstream event by passing the fire-fn down explicitly, or by composing
 * triggers via a higher-level orchestrator.
 */
export const noEventCascade = createRule({
  name: 'no-event-cascade',
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow calling useEvent inside a useAction handler (implicit cascade).',
    },
    messages: {
      cascade:
        'Avoid calling `{{callee}}` inside a `useAction` handler — this creates an implicit cascade. Compose triggers explicitly instead.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    // Stack of CallExpression nodes representing the currently-open
    // `useAction(...)` handlers. We push when entering the handler argument
    // and pop on exit.
    const useActionHandlers: TSESTree.Node[] = [];

    function isUseActionHandlerArgument(node: TSESTree.Node): boolean {
      const parent = node.parent;
      if (!parent || parent.type !== AST_NODE_TYPES.CallExpression) return false;
      // Third positional argument is the handler.
      if (parent.arguments[2] !== node) return false;
      const callee = parent.callee;
      return callee.type === AST_NODE_TYPES.Identifier && callee.name === 'useAction';
    }

    function enterFn(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ): void {
      if (isUseActionHandlerArgument(node)) useActionHandlers.push(node);
    }

    function exitFn(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ): void {
      if (useActionHandlers[useActionHandlers.length - 1] === node) useActionHandlers.pop();
    }

    return {
      FunctionExpression: enterFn,
      ArrowFunctionExpression: enterFn,
      FunctionDeclaration: enterFn,
      'FunctionExpression:exit': exitFn,
      'ArrowFunctionExpression:exit': exitFn,
      'FunctionDeclaration:exit': exitFn,
      CallExpression(node) {
        if (useActionHandlers.length === 0) return;
        if (node.callee.type !== AST_NODE_TYPES.Identifier) return;
        if (node.callee.name !== 'useEvent') return;
        context.report({
          node,
          messageId: 'cascade',
          data: { callee: node.callee.name },
        });
      },
    };
  },
});
