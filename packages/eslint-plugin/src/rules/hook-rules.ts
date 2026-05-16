import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';
import {
  findEnclosingFunction,
  isComponentOrHookFunction,
  TRIGGERY_HOOK_NAMES,
} from '../utils/triggery-call.ts';

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/triggeryjs/triggery/blob/main/packages/eslint-plugin/docs/rules/${name}.md`,
);

/**
 * Triggery hooks (`useEvent`, `useCondition`, `useAction`, `useInlineTrigger`)
 * obey React's rules-of-hooks contract: they may only be called from the
 * top level of a component / hook, never inside conditionals, loops, or
 * regular functions.
 *
 * `react-hooks/rules-of-hooks` covers React; this rule is framework-neutral
 * (Solid + Vue setup() also rely on stable invocation order).
 *
 * Heuristic: the enclosing function name must start with an uppercase
 * letter (a component) or with `use` followed by an uppercase letter (a
 * custom hook). Calls at module scope are also flagged.
 */
export const hookRules = createRule({
  name: 'hook-rules',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Allow Triggery hooks (useEvent/useCondition/useAction) only inside components or other hooks.',
    },
    messages: {
      outside:
        '`{{hook}}` may only be called from a component or a custom hook (function name starting with an uppercase letter or with `use[A-Z]`).',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== AST_NODE_TYPES.Identifier) return;
        const hook = node.callee.name;
        if (!TRIGGERY_HOOK_NAMES.has(hook)) return;
        const fn = findEnclosingFunction(node);
        if (!fn || !isComponentOrHookFunction(fn)) {
          context.report({ node, messageId: 'outside', data: { hook } });
        }
      },
    };
  },
});
