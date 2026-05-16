import { writeFile } from 'node:fs/promises';
import { createProject, isKnownTemplate } from './commands/create.ts';
import { buildTriggerGraph, type GraphFormat, renderGraph } from './commands/graph.ts';
import { runLint } from './commands/lint.ts';
import { scaffoldTrigger } from './commands/scaffold.ts';

const USAGE = `Usage: triggery <command> [options] [args]

Commands:
  create <directory>            Scaffold a new Triggery project from a template.
    --template <name>           One of: vite-react | next-app | react-native (default: vite-react)
    --force                     Overwrite existing directory.

  scaffold trigger <name>       Create a new src/triggers/<name>.trigger.ts file.
    --out-dir <path>            Override the default 'src/triggers' directory.

  graph [directory]             Print the trigger graph (all *.trigger.ts files under directory).
    --format <fmt>              json | dot | md (default: md)
    --out <file>                Write to file instead of stdout.

  lint [...paths]               Run ESLint with @triggery/eslint-plugin (must be installed).
    --fix                       Apply auto-fixable suggestions.

Examples:
  triggery create my-chat --template vite-react
  triggery scaffold trigger new-message
  triggery graph . --format dot --out triggery.dot
  triggery lint src
`;

function parseArgs(argv: readonly string[]): {
  command: string;
  subcommand: string | undefined;
  flags: Map<string, string | boolean>;
  positional: readonly string[];
} {
  const [command = '', ...rest] = argv;
  const flags = new Map<string, string | boolean>();
  const positional: string[] = [];
  let subcommand: string | undefined;
  if (rest[0] && !rest[0].startsWith('--')) {
    subcommand = rest[0];
    rest.shift();
  }
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i] as string;
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith('--')) {
        flags.set(key, next);
        i += 1;
      } else {
        flags.set(key, true);
      }
    } else {
      positional.push(token);
    }
  }
  return { command, subcommand, flags, positional };
}

export async function runCli(argv: readonly string[]): Promise<number> {
  if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') {
    process.stdout.write(USAGE);
    return 0;
  }
  const { command, subcommand, flags, positional } = parseArgs(argv);

  try {
    if (command === 'create') {
      const directory = subcommand ?? positional[0];
      if (!directory) throw new Error('Missing target directory.');
      const tmplFlag = flags.get('template');
      const tmpl = typeof tmplFlag === 'string' ? tmplFlag : 'vite-react';
      if (!isKnownTemplate(tmpl)) {
        throw new Error(
          `Unknown --template '${tmpl}'. Use one of: vite-react | next-app | react-native.`,
        );
      }
      const result = await createProject({
        directory,
        template: tmpl,
        force: Boolean(flags.get('force')),
      });
      process.stdout.write(`Scaffolded ${result.source} → ${result.directory}\n`);
      return 0;
    }

    if (command === 'scaffold' && subcommand === 'trigger') {
      const name = positional[0];
      if (!name) throw new Error('Missing trigger name.');
      const outDirFlag = flags.get('out-dir');
      const path = await scaffoldTrigger({
        name,
        ...(typeof outDirFlag === 'string' ? { outDir: outDirFlag } : {}),
      });
      process.stdout.write(`Created ${path}\n`);
      return 0;
    }

    if (command === 'graph') {
      const cwd = subcommand ?? positional[0] ?? process.cwd();
      const formatFlag = flags.get('format');
      const format: GraphFormat = formatFlag === 'json' || formatFlag === 'dot' ? formatFlag : 'md';
      const nodes = buildTriggerGraph({ cwd });
      const rendered = renderGraph(nodes, format);
      const outFlag = flags.get('out');
      if (typeof outFlag === 'string') {
        await writeFile(outFlag, rendered, 'utf8');
        process.stdout.write(`Graph written to ${outFlag} (${nodes.length} triggers).\n`);
      } else {
        process.stdout.write(`${rendered}\n`);
      }
      return 0;
    }

    if (command === 'lint') {
      const paths = positional.length > 0 ? positional : ['.'];
      return runLint({ paths, fix: Boolean(flags.get('fix')) });
    }

    process.stderr.write(`Unknown command: ${command}\n${USAGE}`);
    return 1;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli(process.argv.slice(2)).then((code) => {
    process.exit(code);
  });
}
