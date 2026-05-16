/**
 * @triggery/vite — auto-discovery plugin.
 *
 * Add the plugin to `vite.config.ts`, then `import 'virtual:triggery-registry'`
 * once at the entry point of your app. The plugin globs every `*.trigger.ts`
 * file at build time and generates a virtual module that imports all of them,
 * so triggers register themselves with the runtime without manual wiring.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { defineConfig } from 'vite';
 * import triggery from '@triggery/vite';
 *
 * export default defineConfig({
 *   plugins: [triggery({ glob: 'src/**\\/*.trigger.ts' })],
 * });
 *
 * // src/main.tsx
 * import 'virtual:triggery-registry';
 * ```
 *
 * HMR: editing an existing trigger file just re-runs its `createTrigger(...)`
 * call — the runtime's last-mount-wins replaces the old registration. Adding
 * or removing a trigger file invalidates the virtual module so its imports
 * list is rebuilt on the next request.
 */

import { glob } from 'tinyglobby';
import type { Plugin } from 'vite';

export type TriggeryViteOptions = {
  /** Glob pattern(s) for trigger files. Default: `'src/**\\/*.trigger.{ts,tsx,js,jsx}'`. */
  readonly glob?: string | readonly string[];
};

const VIRTUAL_ID = 'virtual:triggery-registry';
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`;
const DEFAULT_GLOB = 'src/**/*.trigger.{ts,tsx,js,jsx}';

const isTriggerFile = (file: string): boolean => /\.trigger\.(ts|tsx|js|jsx)$/.test(file);

/**
 * The plugin factory. Default-exported AND named-exported for convenience.
 */
export function triggery(options: TriggeryViteOptions = {}): Plugin {
  const patterns = options.glob ?? DEFAULT_GLOB;
  let projectRoot = process.cwd();

  return {
    name: 'triggery-auto-discovery',
    // Run before user imports so the virtual module is in place at resolution time.
    enforce: 'pre',
    configResolved(cfg) {
      projectRoot = cfg.root;
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID;
      return null;
    },
    async load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return null;
      const files = await glob(patterns, {
        cwd: projectRoot,
        absolute: true,
        onlyFiles: true,
      });
      // Sort for deterministic output (helps cache hits + diffability).
      files.sort();
      const body =
        files.length === 0
          ? '/* @triggery/vite: no *.trigger.* files matched */\n'
          : `${files.map((f) => `import ${JSON.stringify(f)};`).join('\n')}\n`;
      return `${body}export {};\n`;
    },
    handleHotUpdate(ctx) {
      // For new / removed / renamed trigger files we have to rebuild the
      // virtual module's import list. Edits to existing trigger files are
      // already HMR'd by Vite directly — the file's createTrigger call runs
      // again, last-mount-wins replaces the registration.
      if (!isTriggerFile(ctx.file)) return;
      const mod = ctx.server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);
      if (mod) ctx.server.moduleGraph.invalidateModule(mod);
    },
  };
}

export default triggery;
