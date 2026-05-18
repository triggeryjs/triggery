import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/triggeryjs/triggery/blob/main/packages/eslint-plugin/docs/rules/${name}.md`,
);

/**
 * Flag `runtime.registerAction(t.id, 'name', (p) => { for (const cb of subs) cb(p); })`
 * fan-out patterns and suggest the v0.10 action-channel API
 * `t.action('name').subscribe(cb)` instead.
 *
 * Heuristic: the third argument is an arrow function whose body contains a
 * `for-of` over an identifier. Suggestion only — the surrounding `Set + add`
 * pattern is too variable for safe autofix.
 */
export const preferActionChannel = createRule({
  name: 'prefer-action-channel',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Suggest `trigger.action(name).subscribe(cb)` (v0.10+) instead of a hand-rolled `Set<callback> + for-of` fan-out wired through `runtime.registerAction`.',
    },
    messages: {
      preferChannel:
        '`runtime.registerAction("{{name}}", fan-out)` could be expressed with the v0.10 action-channel API: `trigger.action("{{name}}").subscribe(cb)`. The channel is multi-subscriber, typed, and coexists with `runtime.registerAction` (both are invoked on each emit).',
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
          callee.property.name !== 'registerAction'
        ) {
          return;
        }
        const [, nameLit, fn] = node.arguments;
        if (
          !nameLit ||
          nameLit.type !== AST_NODE_TYPES.Literal ||
          typeof nameLit.value !== 'string'
        ) {
          return;
        }
        if (!fn) return;
        if (
          fn.type !== AST_NODE_TYPES.ArrowFunctionExpression &&
          fn.type !== AST_NODE_TYPES.FunctionExpression
        ) {
          return;
        }
        const body = fn.body;
        if (body.type !== AST_NODE_TYPES.BlockStatement) return;
        let hasForOf = false;
        for (const stmt of body.body) {
          if (stmt.type === AST_NODE_TYPES.ForOfStatement) {
            hasForOf = true;
            break;
          }
        }
        if (!hasForOf) return;
        context.report({
          node,
          messageId: 'preferChannel',
          data: { name: nameLit.value },
        });
      },
    };
  },
});
