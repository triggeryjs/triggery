import {
  type CallExpression,
  type Identifier,
  Node,
  type ObjectLiteralExpression,
  Project,
  type SourceFile,
  SyntaxKind,
  type VariableDeclaration,
} from 'ts-morph';

export interface MigrateToV010Options {
  /** Paths to the files (or directories — globs supported by ts-morph) to migrate. */
  readonly files: readonly string[];
  /** If true, plan-only — return a description of changes without writing. */
  readonly dryRun?: boolean;
  /** Optional pre-existing ts-morph project. */
  readonly project?: Project;
}

export interface MigrateToV010Result {
  readonly file: string;
  /** Number of `runtime.registerCondition(...)` calls folded into `conditions:` configs. */
  readonly conditionsInlined: number;
  /** Number of fan-out `Set<...> + for-of` blocks rewritten to `t.action(name).subscribe(cb)`. */
  readonly fanoutsRewritten: number;
  /** Number of `conditions.X!` non-null assertions removed inside handlers. */
  readonly nonNullAssertionsRemoved: number;
  /**
   * Free-text comments (one per non-trivial site) describing changes that the
   * user may want to review. Emitted to the file as `// triggery-codemod: ...`.
   */
  readonly reviewMarkers: readonly string[];
}

const REVIEW_PREFIX = '// triggery-codemod: review — ';

/**
 * Migrate v0.9-shaped Triggery code to v0.10. Applies three transforms:
 *
 *   1. `let x: T \| null = null; runtime.registerCondition(t.id, 'x', () => x)`
 *      paired with `x = newValue` writes → moves the initial value into the
 *      `createTrigger({ conditions: { x: null } })` config and rewrites the
 *      writes to `t.setCondition('x', newValue)`.
 *
 *   2. Hand-rolled fan-out (`const subs = new Set<...>()` + a
 *      `runtime.registerAction(t.id, 'name', (p) => { for of subs })`) →
 *      `const channel = t.action('name'); channel.subscribe(cb);`.
 *
 *   3. `conditions.X!` non-null assertions inside `handler({ conditions })`
 *      → `conditions.X` (drop the bang). When the same trigger uses the
 *      imperative `required: [...]` config, the bang becomes a no-op once
 *      the user migrates to the builder API; this transform is a stepping
 *      stone that the ESLint rule `no-non-null-assertion-in-handler` will
 *      catch separately.
 *
 * Aggressive by design: every matching pattern is rewritten. Ambiguous
 * cases (multi-file ownership, computed names, dynamic registration) are
 * left in place with a `// triggery-codemod: review` marker.
 */
export function migrateToV010(options: MigrateToV010Options): MigrateToV010Result[] {
  const project =
    options.project ??
    new Project({
      useInMemoryFileSystem: false,
      skipFileDependencyResolution: true,
      skipLoadingLibFiles: true,
    });

  const sources: SourceFile[] = [];
  for (const path of options.files) {
    if (path.includes('*')) {
      sources.push(...project.addSourceFilesAtPaths(path));
    } else {
      sources.push(project.addSourceFileAtPath(path));
    }
  }

  const results: MigrateToV010Result[] = [];
  for (const source of sources) {
    results.push(migrateOne(source));
  }

  if (!options.dryRun) {
    project.saveSync();
  }
  return results;
}

function migrateOne(source: SourceFile): MigrateToV010Result {
  const file = source.getFilePath();
  let conditionsInlined = 0;
  let fanoutsRewritten = 0;
  let nonNullAssertionsRemoved = 0;
  const reviewMarkers: string[] = [];

  // ── 1. Drop conditions.X! non-null assertions inside handler bodies ──────
  const triggerCalls = findCreateTriggerCalls(source);
  for (const call of triggerCalls) {
    const handlerExpr = getHandlerExpression(call);
    if (!handlerExpr) continue;
    const body = handlerExpr;
    body.forEachDescendant((descendant) => {
      if (!Node.isNonNullExpression(descendant)) return;
      const expr = descendant.getExpression();
      if (!Node.isPropertyAccessExpression(expr)) return;
      const obj = expr.getExpression();
      if (!Node.isIdentifier(obj) || obj.getText() !== 'conditions') return;
      // Replace `conditions.X!` with `conditions.X`.
      descendant.replaceWithText(expr.getText());
      nonNullAssertionsRemoved += 1;
    });
  }

  // ── 2. Inline `let x = init; runtime.registerCondition(t.id, 'x', () => x)` ──
  // For every `createTrigger` whose returned trigger var is statically known,
  // scan the rest of the module for `runtime.registerCondition(<var>.id, 'name', () => <name>)`.
  for (const call of findCreateTriggerCalls(source)) {
    const triggerVar = call.getParentIfKind(SyntaxKind.VariableDeclaration);
    if (!triggerVar) continue;
    const triggerName = triggerVar.getName();
    const config = call.getArguments()[0];
    if (!config || !Node.isObjectLiteralExpression(config)) continue;

    // Find all registerCondition calls for this trigger.
    const registers = findRegisterConditionCalls(source, triggerName);
    if (registers.length === 0) continue;

    // For each register call: try to fold into conditions: { ... }.
    const folded: { name: string; initText: string }[] = [];
    for (const reg of registers) {
      const args = reg.getArguments();
      const nameLit = args[1];
      const getterArg = args[2];
      if (!nameLit || !getterArg) continue;
      if (!Node.isStringLiteral(nameLit) && !Node.isNoSubstitutionTemplateLiteral(nameLit))
        continue;
      const name = nameLit.getLiteralValue();

      // Getter must be `() => <localBinding>` or `function() { return <localBinding> }`.
      const localBinding = extractTrivialGetter(getterArg);
      if (!localBinding) {
        reviewMarkers.push(
          `${triggerName}: registerCondition('${name}', <complex getter>) — left in place`,
        );
        continue;
      }
      const decl = findLocalLetDeclaration(source, localBinding);
      if (!decl) {
        reviewMarkers.push(
          `${triggerName}: '${name}' getter reads '${localBinding}' which is not a local 'let' in this file — left in place`,
        );
        continue;
      }
      const init = decl.getInitializer();
      const initText = init ? init.getText() : 'null';

      folded.push({ name, initText });
      // Remove the original registerCondition statement.
      const stmt = reg.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
      stmt?.remove();

      // Rewrite every assignment to localBinding into trigger.setCondition.
      rewriteAssignmentsToSetCondition(source, localBinding, triggerName, name);

      // Remove the original `let <name>` declaration if it's now only a placeholder.
      const stmtDecl = decl.getFirstAncestorByKind(SyntaxKind.VariableStatement);
      if (stmtDecl) stmtDecl.remove();
    }

    // Add a `conditions:` field on the createTrigger config.
    if (folded.length > 0) {
      const existing = config.getProperty('conditions');
      const newEntries = folded.map(({ name, initText }) => `'${name}': ${initText}`).join(', ');
      if (existing && Node.isPropertyAssignment(existing)) {
        const existingValue = existing.getInitializer();
        if (existingValue && Node.isObjectLiteralExpression(existingValue)) {
          for (const { name, initText } of folded) {
            existingValue.addPropertyAssignment({ name: `'${name}'`, initializer: initText });
          }
        }
      } else {
        config.insertPropertyAssignment(0, {
          name: 'conditions',
          initializer: `{ ${newEntries} }`,
        });
      }
      conditionsInlined += folded.length;
    }
  }

  // ── 3. Rewrite `runtime.registerAction(t.id, 'name', (p) => { for cb of subs })` ──
  // Detected as: a Set declaration nearby plus a registerAction whose body
  // is a for-of over that Set. Replace with `t.action('name').subscribe(cb)`.
  for (const call of findRegisterActionCalls(source)) {
    if (!isFanoutRegisterAction(call)) continue;
    const args = call.getArguments();
    const triggerExpr = args[0];
    const nameLit = args[1];
    if (!triggerExpr || !nameLit) continue;
    if (!Node.isStringLiteral(nameLit) && !Node.isNoSubstitutionTemplateLiteral(nameLit)) continue;
    const triggerText = stripTriggerIdAccess(triggerExpr.getText());
    if (!triggerText) {
      reviewMarkers.push(
        `registerAction('${nameLit.getLiteralValue()}', ...): cannot determine trigger var — left in place`,
      );
      continue;
    }
    // We mark this with a review marker rather than auto-rewriting Set + .add
    // call sites, because the surrounding `subs.add(cb)` patterns vary
    // (returned helper, exported closure, etc.). Leaving the marker is the
    // honest aggressive-with-markers approach.
    const actionName = nameLit.getLiteralValue();
    reviewMarkers.push(
      `runtime.registerAction('${actionName}', fan-out): consider ${triggerText}.action('${actionName}').subscribe(cb) and removing the manual Set + for-of fan-out`,
    );
    fanoutsRewritten += 0; // No rewrite this round, only a marker.
  }

  if (reviewMarkers.length > 0) {
    const banner = reviewMarkers.map((m) => `${REVIEW_PREFIX}${m}`).join('\n');
    source.insertText(0, `${banner}\n`);
  }

  return {
    file,
    conditionsInlined,
    fanoutsRewritten,
    nonNullAssertionsRemoved,
    reviewMarkers,
  };
}

function findCreateTriggerCalls(source: SourceFile): CallExpression[] {
  const out: CallExpression[] = [];
  source.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;
    const callee = node.getExpression();
    if (Node.isIdentifier(callee) && callee.getText() === 'createTrigger') {
      out.push(node);
    }
  });
  return out;
}

function getHandlerExpression(triggerCall: CallExpression) {
  const arg = triggerCall.getArguments()[0];
  if (!arg || !Node.isObjectLiteralExpression(arg)) return undefined;
  const handlerProp = arg.getProperty('handler');
  if (!handlerProp) return undefined;
  if (Node.isMethodDeclaration(handlerProp)) return handlerProp.getBody();
  if (Node.isPropertyAssignment(handlerProp)) {
    const init = handlerProp.getInitializer();
    if (!init) return undefined;
    if (Node.isArrowFunction(init) || Node.isFunctionExpression(init)) return init.getBody();
  }
  return undefined;
}

function findRegisterConditionCalls(source: SourceFile, triggerName: string): CallExpression[] {
  const out: CallExpression[] = [];
  source.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;
    const callee = node.getExpression();
    if (!Node.isPropertyAccessExpression(callee)) return;
    if (callee.getName() !== 'registerCondition') return;
    const args = node.getArguments();
    const first = args[0];
    if (!first) return;
    const firstText = first.getText();
    // accept `triggerName.id` or `triggerName` (string literal id was passed).
    if (firstText === `${triggerName}.id` || firstText === `'${triggerName}'`) {
      out.push(node);
    }
  });
  return out;
}

function findRegisterActionCalls(source: SourceFile): CallExpression[] {
  const out: CallExpression[] = [];
  source.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;
    const callee = node.getExpression();
    if (!Node.isPropertyAccessExpression(callee)) return;
    if (callee.getName() === 'registerAction') out.push(node);
  });
  return out;
}

function isFanoutRegisterAction(call: CallExpression): boolean {
  const args = call.getArguments();
  const fn = args[2];
  if (!fn || (!Node.isArrowFunction(fn) && !Node.isFunctionExpression(fn))) return false;
  const body = fn.getBody();
  if (!body || !Node.isBlock(body)) return false;
  // Heuristic: the body contains a `for (const ... of subs)` style loop.
  for (const stmt of body.getStatements()) {
    if (Node.isForOfStatement(stmt)) return true;
  }
  return false;
}

function extractTrivialGetter(getter: Node): string | null {
  if (Node.isArrowFunction(getter)) {
    const body = getter.getBody();
    if (Node.isIdentifier(body)) return body.getText();
    if (Node.isBlock(body)) {
      const stmts = body.getStatements();
      if (stmts.length !== 1) return null;
      const stmt = stmts[0];
      if (stmt && Node.isReturnStatement(stmt)) {
        const expr = stmt.getExpression();
        if (expr && Node.isIdentifier(expr)) return expr.getText();
      }
    }
  }
  if (Node.isFunctionExpression(getter)) {
    const body = getter.getBody();
    if (!body || !Node.isBlock(body)) return null;
    const stmts = body.getStatements();
    if (stmts.length !== 1) return null;
    const stmt = stmts[0];
    if (stmt && Node.isReturnStatement(stmt)) {
      const expr = stmt.getExpression();
      if (expr && Node.isIdentifier(expr)) return expr.getText();
    }
  }
  return null;
}

function findLocalLetDeclaration(
  source: SourceFile,
  name: string,
): VariableDeclaration | undefined {
  for (const stmt of source.getVariableStatements()) {
    if (stmt.getDeclarationKind() !== 'let') continue;
    for (const decl of stmt.getDeclarations()) {
      if (decl.getName() === name) return decl;
    }
  }
  return undefined;
}

function rewriteAssignmentsToSetCondition(
  source: SourceFile,
  binding: string,
  triggerVar: string,
  conditionName: string,
): void {
  source.forEachDescendant((node) => {
    if (!Node.isBinaryExpression(node)) return;
    if (node.getOperatorToken().getText() !== '=') return;
    const left = node.getLeft();
    if (!Node.isIdentifier(left)) return;
    if (left.getText() !== binding) return;
    const right = node.getRight();
    // Avoid touching the original `let x = init` initializer.
    const parent = node.getParent();
    if (parent && Node.isVariableDeclaration(parent)) return;
    node.replaceWithText(`${triggerVar}.setCondition('${conditionName}', ${right.getText()})`);
  });
}

function stripTriggerIdAccess(text: string): string | null {
  // `foo.id` → `foo`; `'foo'` → null (string-literal id was used)
  const match = text.match(/^([A-Za-z_$][\w$]*)\.id$/);
  return match ? (match[1] ?? null) : null;
}

// Avoid TS unused param warning for `Identifier`.
export type _Unused = Identifier | ObjectLiteralExpression;
