import { Node } from 'ts-morph';

export function slugify(input: string): string {
  return (
    input
      // PascalCase / camelCase → kebab-case
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  );
}

export function kebabToCamel(input: string): string {
  return input
    .split('-')
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

export function kebabToPascal(input: string): string {
  return input
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * `useEffect` calls only mean anything inside a hook or component. The
 * `extract-trigger` codemod uses this guard before rewriting the call site
 * to skip stray top-level `useEffect`s (which won't run anyway).
 */
export function isInsideHook(node: Node): boolean {
  let parent: Node | undefined = node.getParent();
  while (parent) {
    if (
      Node.isFunctionDeclaration(parent) ||
      Node.isArrowFunction(parent) ||
      Node.isFunctionExpression(parent) ||
      Node.isMethodDeclaration(parent)
    ) {
      const name = getFunctionName(parent);
      if (name && (/^[A-Z]/.test(name) || /^use[A-Z]/.test(name))) return true;
    }
    parent = parent.getParent();
  }
  return false;
}

function getFunctionName(node: Node): string | null {
  if (Node.isFunctionDeclaration(node)) {
    return node.getName() ?? null;
  }
  const parent = node.getParent();
  if (!parent) return null;
  if (Node.isVariableDeclaration(parent)) return parent.getName();
  if (Node.isPropertyAssignment(parent)) {
    const name = parent.getName();
    return name;
  }
  return null;
}
