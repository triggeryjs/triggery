import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface ScaffoldTriggerOptions {
  readonly name: string;
  readonly outDir?: string;
  readonly cwd?: string;
}

function kebabToCamel(input: string): string {
  return input
    .split('-')
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

/**
 * Generates `<name>.trigger.ts` at `<cwd>/<outDir>/<name>.trigger.ts`. The
 * template is intentionally minimal — a complete scaffold (events,
 * conditions, actions) would lock contributors into a structure that
 * varies per scenario.
 */
export async function scaffoldTrigger(options: ScaffoldTriggerOptions): Promise<string> {
  const cwd = options.cwd ?? process.cwd();
  const outDir = options.outDir ?? 'src/triggers';
  const path = join(cwd, outDir, `${options.name}.trigger.ts`);
  const symbol = `${kebabToCamel(options.name)}Trigger`;

  const content = `import { createTrigger } from '@triggery/core';

export const ${symbol} = createTrigger<{
  events: { '${options.name}': void };
  conditions: Record<string, never>;
  actions: Record<string, never>;
}>({
  id: '${options.name}',
  events: ['${options.name}'],
  required: [],
  handler({ event, conditions, actions, check }) {
    // TODO: implement the scenario.
  },
});
`;

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
  return path;
}
