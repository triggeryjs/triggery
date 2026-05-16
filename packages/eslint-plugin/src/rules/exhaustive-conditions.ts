import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils';
import { getStringLiteralValue, isCreateTriggerCall } from '../utils/triggery-call.ts';

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/triggeryjs/triggery/blob/main/packages/eslint-plugin/docs/rules/${name}.md`,
);

interface TriggerInfo {
  readonly varName: string;
  readonly required: readonly string[];
  readonly node: TSESTree.Node;
}

/**
 * Cross-checks `required` against `useCondition` registrations *within the
 * same file*. If the trigger declares `required: ['user', 'settings']` and
 * the file never calls `useCondition(thisTrigger, 'user', ...)` for one of
 * them, the handler will always skip with `missing-required` — which is
 * almost certainly not what the author intended.
 *
 * File-local scope by design: cross-file analysis is significantly more
 * expensive and the file-local heuristic catches ~80% of real mistakes (a
 * trigger and its first provider almost always sit in the same module
 * during initial wiring).
 */
export const exhaustiveConditions = createRule({
  name: 'exhaustive-conditions',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ensure every `required` condition of a trigger has at least one `useCondition` registration in the same file.',
    },
    messages: {
      missing:
        "Trigger `{{trigger}}` declares `required: [..., '{{name}}', ...]`, but this file has no `useCondition({{trigger}}, '{{name}}', ...)`. The handler will always skip with `missing-required`.",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const triggers: TriggerInfo[] = [];
    const provided = new Map<string, Set<string>>(); // trigger var → set of condition names

    function record(triggerVar: string, conditionName: string): void {
      let set = provided.get(triggerVar);
      if (!set) {
        set = new Set();
        provided.set(triggerVar, set);
      }
      set.add(conditionName);
    }

    return {
      CallExpression(node) {
        if (isCreateTriggerCall(node)) {
          // Find the variable being assigned: `export const foo = createTrigger({...})`.
          const parent = node.parent;
          if (!parent || parent.type !== AST_NODE_TYPES.VariableDeclarator) return;
          if (parent.id.type !== AST_NODE_TYPES.Identifier) return;
          const varName = parent.id.name;

          const config = node.arguments[0];
          if (!config || config.type !== AST_NODE_TYPES.ObjectExpression) return;
          const requiredProp = config.properties.find(
            (p): p is TSESTree.Property =>
              p.type === AST_NODE_TYPES.Property &&
              p.key.type === AST_NODE_TYPES.Identifier &&
              p.key.name === 'required',
          );
          if (!requiredProp) return;
          if (requiredProp.value.type !== AST_NODE_TYPES.ArrayExpression) return;
          const required: string[] = [];
          for (const el of requiredProp.value.elements) {
            const name = getStringLiteralValue(el ?? undefined);
            if (name) required.push(name);
          }
          if (required.length > 0) triggers.push({ varName, required, node: requiredProp.value });
          return;
        }

        if (
          node.callee.type === AST_NODE_TYPES.Identifier &&
          node.callee.name === 'useCondition' &&
          node.arguments[0] &&
          node.arguments[0].type === AST_NODE_TYPES.Identifier &&
          node.arguments[1]
        ) {
          const triggerVar = node.arguments[0].name;
          const conditionName = getStringLiteralValue(node.arguments[1]);
          if (conditionName) record(triggerVar, conditionName);
        }
      },
      'Program:exit'() {
        for (const trigger of triggers) {
          const set = provided.get(trigger.varName) ?? new Set<string>();
          for (const name of trigger.required) {
            if (!set.has(name)) {
              context.report({
                node: trigger.node,
                messageId: 'missing',
                data: { trigger: trigger.varName, name },
              });
            }
          }
        }
      },
    };
  },
});
