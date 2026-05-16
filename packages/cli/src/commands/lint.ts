import { spawn } from 'node:child_process';

export interface LintOptions {
  readonly paths: readonly string[];
  readonly fix?: boolean;
  readonly cwd?: string;
}

/**
 * Thin shim around the local `eslint` binary. We deliberately do not bundle
 * ESLint here — adopters install it as a peer dep alongside
 * `@triggery/eslint-plugin`, and this command just forwards arguments.
 *
 * The shim exists because:
 *   - Adopters get a single entry point (`triggery lint`) regardless of
 *     which framework they use.
 *   - Future versions can wire in custom reporters or formatter selection
 *     without changing the public surface.
 */
export async function runLint(options: LintOptions): Promise<number> {
  const args: string[] = [];
  if (options.fix) args.push('--fix');
  args.push(...options.paths);

  return new Promise((resolve) => {
    const child = spawn('eslint', args, {
      stdio: 'inherit',
      cwd: options.cwd ?? process.cwd(),
      shell: false,
    });
    child.on('exit', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(127));
  });
}
