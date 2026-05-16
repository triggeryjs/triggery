import { dirname, join } from 'node:path';
import { type CallExpression, Node, Project, type SourceFile, SyntaxKind } from 'ts-morph';
import { isInsideHook, kebabToCamel, slugify } from '../utils.ts';

export interface ExtractTriggerOptions {
  /** Path to the source `.tsx` file. */
  readonly file: string;
  /** Directory where the generated `*.trigger.ts` file should land. Defaults to the source file's directory. */
  readonly outDir?: string;
  /** Trigger id (kebab-case). Used to derive symbol/file names. */
  readonly name: string;
  /**
   * If true, the codemod just plans the changes and returns them without
   * writing to disk. Useful for previews / dry-run.
   */
  readonly dryRun?: boolean;
  /**
   * Optional pre-existing ts-morph project. The codemod will add `file` to
   * it. Lets the CLI reuse one tsconfig across batches.
   */
  readonly project?: Project;
}

export interface ExtractTriggerResult {
  readonly sourceUpdated: boolean;
  readonly triggerFilePath: string;
  readonly triggerFileContent: string;
  readonly originalEffectBody: string;
}

/**
 * Extracts the first `useEffect(() => { ... }, [])` in a component into a
 * dedicated `*.trigger.ts` file. The component is rewritten to fire the new
 * event instead of running the effect inline.
 *
 * This is a pragmatic V1 — it covers the common shape (single useEffect with
 * a clear side-effect body). For complex effects (cleanup functions,
 * multiple effects in one file, dynamic deps) you will need to follow up
 * manually; the codemod stops at the first match and reports what it did.
 */
export function extractTrigger(options: ExtractTriggerOptions): ExtractTriggerResult {
  const project =
    options.project ??
    new Project({
      useInMemoryFileSystem: false,
      skipFileDependencyResolution: true,
      skipLoadingLibFiles: true,
    });

  const source: SourceFile = project.addSourceFileAtPath(options.file);
  const useEffectCall = findFirstUseEffect(source);
  if (!useEffectCall) {
    throw new Error(
      `[triggery/codemod] No useEffect call found in ${options.file}. Nothing to extract.`,
    );
  }

  const handler = useEffectCall.getArguments()[0];
  if (!handler || (!Node.isArrowFunction(handler) && !Node.isFunctionExpression(handler))) {
    throw new Error(
      `[triggery/codemod] useEffect's first argument is not a function in ${options.file}.`,
    );
  }
  const body = handler.getBody();
  const bodyText = Node.isBlock(body)
    ? body
        .getText()
        .replace(/^{\s*|\s*}$/g, '')
        .trim()
    : `return ${body.getText()};`;

  const eventName = slugify(options.name);
  const symbolName = `${kebabToCamel(eventName)}Trigger`;
  const triggerFilePath = join(options.outDir ?? dirname(options.file), `${eventName}.trigger.ts`);

  const triggerContent = renderTriggerFile({ symbolName, eventName, bodyText });

  // Rewrite the source: replace the useEffect call with a useEvent(...) call.
  // We deliberately leave the import statement editing to the developer — the
  // codemod prints a hint with the import line to add. This keeps the AST
  // changes minimal and predictable.
  const useEffectStatement = useEffectCall.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
  if (useEffectStatement && isInsideHook(useEffectStatement)) {
    useEffectStatement.replaceWithText(
      `// Migrated to ./${eventName}.trigger.ts — fire the event instead of running the effect inline.\n` +
        `useEvent(${symbolName}, '${eventName}');`,
    );
  }

  if (!options.dryRun) {
    project.createSourceFile(triggerFilePath, triggerContent, { overwrite: true });
    project.saveSync();
  }

  return {
    sourceUpdated: Boolean(useEffectStatement),
    triggerFilePath,
    triggerFileContent: triggerContent,
    originalEffectBody: bodyText,
  };
}

function findFirstUseEffect(source: SourceFile): CallExpression | null {
  for (const call of source.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expr = call.getExpression();
    if (expr.getKind() === SyntaxKind.Identifier && expr.getText() === 'useEffect') {
      return call;
    }
  }
  return null;
}

function renderTriggerFile(opts: {
  symbolName: string;
  eventName: string;
  bodyText: string;
}): string {
  // Indent the original body two levels (handler body) for readability.
  const indented = opts.bodyText
    .split('\n')
    .map((line) => (line.length === 0 ? line : `    ${line}`))
    .join('\n');

  return `import { createTrigger } from '@triggery/core';

/**
 * Extracted automatically by @triggery/codemod from a useEffect block.
 * Review the generated handler — the codemod does its best but cannot infer
 * the runtime "events / conditions / actions" surface without your input.
 *
 * Next steps:
 *   1. Declare the proper Schema generic below.
 *   2. Move side-effects into named \`actions.<name>\` calls; declare the
 *      actions in the generic and register them via \`useAction\` in the
 *      component(s) that own them.
 *   3. Move read-only inputs into typed \`conditions\` and register them via
 *      \`useCondition\` instead of relying on captured closure state.
 *   4. Delete the TODO marker once the migration is complete.
 */
export const ${opts.symbolName} = createTrigger<{
  events: { '${opts.eventName}': void };
  conditions: Record<string, never>;
  actions: Record<string, never>;
}>({
  id: '${opts.eventName}',
  events: ['${opts.eventName}'],
  required: [],
  handler({ event, conditions, actions, check }) {
    // TODO: migrated from useEffect — refactor side effects into actions.
${indented}
  },
});
`;
}
