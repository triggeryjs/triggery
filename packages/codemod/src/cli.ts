import { extractTrigger } from './codemods/extract-trigger.ts';
import { migrateFromListenerMiddleware } from './codemods/migrate-from-listener-middleware.ts';

const USAGE = `Usage: triggery-codemod <command> [options] <file>

Commands:
  extract-trigger                   Extract a useEffect block into a *.trigger.ts file.
    --name <kebab-case>             Trigger event name (required).
    --out-dir <path>                Directory for the generated trigger file. Defaults to the source file's directory.
    --dry-run                       Print planned changes without writing.

  migrate-from-listener-middleware  Generate triggers from RTK listenerMiddleware.startListening({ actionCreator, effect }).
    --out-dir <path>                Directory for the generated trigger files.
    --dry-run                       Print planned changes without writing.

Examples:
  triggery-codemod extract-trigger --name new-message src/Chat.tsx
  triggery-codemod migrate-from-listener-middleware src/store/middleware.ts
`;

function parseArgs(argv: readonly string[]): {
  command: string;
  flags: Map<string, string | boolean>;
  positional: readonly string[];
} {
  const [command = '', ...rest] = argv;
  const flags = new Map<string, string | boolean>();
  const positional: string[] = [];
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
  return { command, flags, positional };
}

export async function runCli(argv: readonly string[]): Promise<number> {
  if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') {
    process.stdout.write(USAGE);
    return 0;
  }
  const { command, flags, positional } = parseArgs(argv);
  const file = positional[0];

  try {
    if (command === 'extract-trigger') {
      if (!file) throw new Error('Missing source file argument.');
      const nameFlag = flags.get('name');
      const name = typeof nameFlag === 'string' ? nameFlag : undefined;
      if (!name) throw new Error('Missing required --name <kebab-case>.');
      const outDirFlag = flags.get('out-dir');
      const outDir = typeof outDirFlag === 'string' ? outDirFlag : undefined;
      const result = extractTrigger({
        file,
        name,
        ...(outDir !== undefined ? { outDir } : {}),
        dryRun: Boolean(flags.get('dry-run')),
      });
      process.stdout.write(`Generated ${result.triggerFilePath}\n`);
      process.stdout.write('Add this import to the component file:\n');
      process.stdout.write(
        `  import { ${result.triggerFilePath.split('/').pop()?.replace('.trigger.ts', 'Trigger')} } from './${result.triggerFilePath.split('/').pop()?.replace('.ts', '')}';\n`,
      );
      return 0;
    }

    if (command === 'migrate-from-listener-middleware') {
      if (!file) throw new Error('Missing source file argument.');
      const outDirFlag = flags.get('out-dir');
      const outDir = typeof outDirFlag === 'string' ? outDirFlag : undefined;
      const result = migrateFromListenerMiddleware({
        file,
        ...(outDir !== undefined ? { outDir } : {}),
        dryRun: Boolean(flags.get('dry-run')),
      });
      process.stdout.write(`Migrated ${result.migrated.length} listener(s) from ${result.file}:\n`);
      for (const m of result.migrated) {
        process.stdout.write(`  • ${m.eventName} → ${m.triggerFilePath}\n`);
      }
      return 0;
    }

    process.stderr.write(`Unknown command: ${command}\n${USAGE}`);
    return 1;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    return 1;
  }
}

// Standalone execution: `triggery-codemod extract-trigger --name x src/foo.tsx`.
// When tsup bundles this file as a `bin`, the banner `#!/usr/bin/env node` is
// prepended automatically and import.meta.url is the absolute file URL.
if (import.meta.url === `file://${process.argv[1]}`) {
  runCli(process.argv.slice(2)).then((code) => {
    process.exit(code);
  });
}
