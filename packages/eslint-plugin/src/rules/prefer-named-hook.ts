import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils';
import { getStringLiteralValue, toPascalCase } from '../utils/triggery-call.ts';

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/triggeryjs/triggery/blob/main/packages/eslint-plugin/docs/rules/${name}.md`,
);

/**
 * In files with many `useEvent/useCondition/useAction` calls, the named
 * variants (`useNewMessageEvent`, `useUserCondition`, …) read much better.
 * The runtime exposes them via `messageTrigger.namedHooks()`; this rule
 * suggests the switch once a file has enough port calls to benefit.
 */
export const preferNamedHook = createRule<[{ threshold?: number }], 'prefer'>({
  name: 'prefer-named-hook',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'In files with many port calls, prefer named hooks (useFooEvent) over generic useEvent("foo").',
    },
    messages: {
      prefer:
        'Consider using `{{suggestion}}` instead of `{{generic}}` once a file has many ({{count}} ≥ {{threshold}}) port calls.',
    },
    schema: [
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          threshold: { type: 'integer', minimum: 1 },
        },
      },
    ],
  },
  defaultOptions: [{ threshold: 4 }],
  create(context, [options]) {
    const threshold = options.threshold ?? 4;
    const portCalls: Array<{ node: TSESTree.CallExpression; kind: string; name: string }> = [];

    function suffixFor(kind: string): string {
      switch (kind) {
        case 'useEvent':
          return 'Event';
        case 'useCondition':
          return 'Condition';
        case 'useAction':
          return 'Action';
        default:
          return '';
      }
    }

    return {
      CallExpression(node) {
        if (node.callee.type !== AST_NODE_TYPES.Identifier) return;
        const name = node.callee.name;
        if (!['useEvent', 'useCondition', 'useAction'].includes(name)) return;
        const portArg = node.arguments[1];
        const portName = getStringLiteralValue(portArg);
        if (!portName) return;
        portCalls.push({ node, kind: name, name: portName });
      },
      'Program:exit'() {
        if (portCalls.length < threshold) return;
        for (const call of portCalls) {
          const suggestion = `use${toPascalCase(call.name)}${suffixFor(call.kind)}`;
          context.report({
            node: call.node,
            messageId: 'prefer',
            data: {
              suggestion,
              generic: `${call.kind}(…, '${call.name}', …)`,
              count: portCalls.length,
              threshold,
            },
          });
        }
      },
    };
  },
});
