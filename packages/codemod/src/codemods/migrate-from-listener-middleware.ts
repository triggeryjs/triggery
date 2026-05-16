import { dirname, join } from 'node:path';
import {
  type CallExpression,
  Node,
  type ObjectLiteralExpression,
  Project,
  type SourceFile,
  SyntaxKind,
} from 'ts-morph';
import { kebabToCamel, slugify } from '../utils.ts';

export interface MigrateFromListenerMiddlewareOptions {
  readonly file: string;
  readonly outDir?: string;
  readonly dryRun?: boolean;
  readonly project?: Project;
}

export interface MigratedListener {
  readonly eventName: string;
  readonly triggerFilePath: string;
  readonly triggerFileContent: string;
}

export interface MigrateFromListenerMiddlewareResult {
  readonly file: string;
  readonly migrated: readonly MigratedListener[];
}

/**
 * Walks a file that uses RTK's createListenerMiddleware / startListening and
 * generates one `*.trigger.ts` per `startListening({ actionCreator, effect })`
 * registration. The source file is left untouched — adopters review the
 * generated triggers, wire them into their components via `useEvent`, then
 * delete the middleware registration when ready.
 *
 * V1 supports the canonical shape:
 *
 *     startListening({ actionCreator: someAction, effect: (action, api) => {...} })
 *
 * Other listenerMiddleware patterns (matcher, predicate, type) are reported
 * but not transformed in this iteration.
 */
export function migrateFromListenerMiddleware(
  options: MigrateFromListenerMiddlewareOptions,
): MigrateFromListenerMiddlewareResult {
  const project =
    options.project ??
    new Project({
      useInMemoryFileSystem: false,
      skipFileDependencyResolution: true,
      skipLoadingLibFiles: true,
    });

  const source: SourceFile = project.addSourceFileAtPath(options.file);
  const migrated: MigratedListener[] = [];

  for (const call of findStartListeningCalls(source)) {
    const arg = call.getArguments()[0];
    if (!arg || !Node.isObjectLiteralExpression(arg)) continue;
    const actionCreator = readActionCreator(arg);
    const effect = readEffectBody(arg);
    if (!actionCreator || effect === null) continue;

    const eventName = slugify(actionCreator);
    const symbolName = `${kebabToCamel(eventName)}Trigger`;
    const triggerContent = renderTriggerFile({ symbolName, eventName, effect });
    const triggerFilePath = join(
      options.outDir ?? dirname(options.file),
      `${eventName}.trigger.ts`,
    );

    if (!options.dryRun) {
      project.createSourceFile(triggerFilePath, triggerContent, { overwrite: true });
    }
    migrated.push({ eventName, triggerFilePath, triggerFileContent: triggerContent });
  }

  if (!options.dryRun && migrated.length > 0) project.saveSync();
  return { file: options.file, migrated };
}

function findStartListeningCalls(source: SourceFile): CallExpression[] {
  const out: CallExpression[] = [];
  for (const call of source.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expr = call.getExpression();
    if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
      const text = expr.getText();
      if (text.endsWith('.startListening')) out.push(call);
    } else if (expr.getKind() === SyntaxKind.Identifier && expr.getText() === 'startListening') {
      out.push(call);
    }
  }
  return out;
}

function readActionCreator(arg: ObjectLiteralExpression): string | null {
  const prop = arg.getProperty('actionCreator');
  if (!prop || !Node.isPropertyAssignment(prop)) return null;
  const init = prop.getInitializer();
  if (!init) return null;
  // Use the symbol name as the canonical event id; the codemod doesn't try to
  // resolve `.type` on the action creator (that would require type info).
  return init.getText();
}

function readEffectBody(arg: ObjectLiteralExpression): string | null {
  const prop = arg.getProperty('effect');
  if (!prop || !Node.isPropertyAssignment(prop)) return null;
  const init = prop.getInitializer();
  if (!init) return null;
  if (Node.isArrowFunction(init) || Node.isFunctionExpression(init)) {
    const body = init.getBody();
    if (Node.isBlock(body))
      return body
        .getText()
        .replace(/^{\s*|\s*}$/g, '')
        .trim();
    return `return ${body.getText()};`;
  }
  return null;
}

function renderTriggerFile(opts: {
  symbolName: string;
  eventName: string;
  effect: string;
}): string {
  const indented = opts.effect
    .split('\n')
    .map((line) => (line.length === 0 ? line : `    ${line}`))
    .join('\n');

  return `import { createTrigger } from '@triggery/core';

/**
 * Auto-migrated from a Redux Toolkit listenerMiddleware \`startListening\`
 * registration. Review the generated handler — the original \`effect\` ran
 * inside an RTK store context (listenerApi.dispatch, etc.) which Triggery
 * does not provide directly. Recommended steps:
 *
 *   1. Replace \`listenerApi.dispatch(x)\` with a Triggery action:
 *      add an \`actions.<name>\` entry to the generic and call it inside the
 *      handler.
 *   2. Replace reads of \`listenerApi.getState()\` with typed conditions.
 *   3. Wire the new \`actions\` via \`useAction\` and \`conditions\` via
 *      \`useCondition\` in the appropriate components.
 */
export const ${opts.symbolName} = createTrigger<{
  events: { '${opts.eventName}': unknown };
  conditions: Record<string, never>;
  actions: Record<string, never>;
}>({
  id: '${opts.eventName}',
  events: ['${opts.eventName}'],
  required: [],
  async handler({ event, conditions, actions, check }) {
    // TODO: original RTK effect body — refactor dispatch/getState into actions/conditions.
    const action = event.payload;
${indented}
  },
});
`;
}
