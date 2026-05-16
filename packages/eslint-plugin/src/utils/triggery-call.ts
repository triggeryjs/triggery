import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

/**
 * Detect calls of the form `useEvent(trigger, 'event-name')`,
 * `useCondition(trigger, 'name', ...)`, `useAction(trigger, 'name', handler)`,
 * etc. The first positional argument is always the trigger reference,
 * the second is the port name as a string literal (or template literal).
 *
 * We match on the callee name only — adopters import these hooks under their
 * canonical names (and the `no-restricted-imports` rule in our recommended
 * config keeps it that way).
 */
export const TRIGGERY_HOOK_NAMES = new Set([
  'useEvent',
  'useCondition',
  'useAction',
  'useInlineTrigger',
]);

export function isTriggeryHookCall(node: TSESTree.CallExpression): boolean {
  return (
    node.callee.type === AST_NODE_TYPES.Identifier && TRIGGERY_HOOK_NAMES.has(node.callee.name)
  );
}

export function isCreateTriggerCall(node: TSESTree.CallExpression): boolean {
  const callee = node.callee;
  if (callee.type === AST_NODE_TYPES.Identifier && callee.name === 'createTrigger') return true;
  // Allow `triggery.createTrigger(...)` style.
  if (
    callee.type === AST_NODE_TYPES.MemberExpression &&
    callee.property.type === AST_NODE_TYPES.Identifier &&
    callee.property.name === 'createTrigger'
  ) {
    return true;
  }
  return false;
}

export function getStringLiteralValue(node: TSESTree.Node | undefined): string | null {
  if (!node) return null;
  if (node.type === AST_NODE_TYPES.Literal && typeof node.value === 'string') {
    return node.value;
  }
  if (
    node.type === AST_NODE_TYPES.TemplateLiteral &&
    node.expressions.length === 0 &&
    node.quasis.length === 1 &&
    node.quasis[0]
  ) {
    return node.quasis[0].value.cooked;
  }
  return null;
}

/**
 * Convert `'new-message'` → `'NewMessage'` so we can suggest
 * `useNewMessageEvent` etc.
 */
export function toPascalCase(name: string): string {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Walks up the AST looking for the enclosing function (declaration, expression
 * or arrow). Returns the function node, or `null` if the call is at module top
 * level.
 */
export function findEnclosingFunction(
  node: TSESTree.Node,
):
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression
  | null {
  let current: TSESTree.Node | undefined = node.parent;
  while (current) {
    if (
      current.type === AST_NODE_TYPES.FunctionDeclaration ||
      current.type === AST_NODE_TYPES.FunctionExpression ||
      current.type === AST_NODE_TYPES.ArrowFunctionExpression
    ) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

/**
 * Heuristic — a function "looks like a React/Solid/Vue component or hook" if
 * its name starts with an uppercase letter (Component) or with `use`
 * (custom hook). For anonymous arrows we fall back to looking at the
 * variable declarator name.
 */
export function isComponentOrHookFunction(
  fn: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
): boolean {
  const name = getFunctionName(fn);
  if (!name) return false;
  return /^[A-Z]/.test(name) || /^use[A-Z]/.test(name);
}

export function getFunctionName(
  fn: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
): string | null {
  if (fn.type === AST_NODE_TYPES.FunctionDeclaration && fn.id) return fn.id.name;
  if (fn.type === AST_NODE_TYPES.FunctionExpression && fn.id) return fn.id.name;
  const parent = fn.parent;
  if (parent && parent.type === AST_NODE_TYPES.VariableDeclarator) {
    const id = parent.id;
    if (id.type === AST_NODE_TYPES.Identifier) return id.name;
  }
  if (parent && parent.type === AST_NODE_TYPES.Property) {
    const key = parent.key;
    if (key.type === AST_NODE_TYPES.Identifier) return key.name;
  }
  return null;
}
