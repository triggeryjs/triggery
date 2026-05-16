import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HmrContext, Plugin, ResolvedConfig } from 'vite';
import { describe, expect, it, vi } from 'vitest';
import triggery from '../src/index.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesRoot = path.join(here, 'fixtures');

/**
 * Vite plugin hooks can be either bare functions or "ObjectHook" objects
 * (`{ handler, order }`). Normalize to the function so tests stay tight.
 */
function asFn<T>(hook: T | { handler: T } | undefined): T | undefined {
  if (!hook) return undefined;
  if (typeof hook === 'object' && 'handler' in hook) return hook.handler;
  return hook;
}

/**
 * Build a minimal stub of Vite's `ResolvedConfig` — only the bits the plugin
 * actually reads (`root`). Going through `unknown` avoids `as any` on every
 * call site.
 */
const stubResolvedConfig = (root: string): ResolvedConfig =>
  ({ root }) as unknown as ResolvedConfig;

const stubHmrCtx = (file: string, server: unknown): HmrContext =>
  ({ file, server, modules: [], timestamp: 0 }) as unknown as HmrContext;

function withRoot(plugin: Plugin, root: string): Plugin {
  const configResolved = asFn(plugin.configResolved);
  void configResolved?.call(plugin as never, stubResolvedConfig(root));
  return plugin;
}

describe('@triggery/vite — resolveId / load', () => {
  it('resolves the virtual id', () => {
    const plugin = triggery();
    const resolveId = asFn(plugin.resolveId);
    expect(resolveId).toBeDefined();
    const resolved = resolveId?.call(
      plugin as never,
      'virtual:triggery-registry',
      undefined,
      {} as never,
    );
    expect(resolved).toBe('\0virtual:triggery-registry');
  });

  it('returns null for any other id', () => {
    const plugin = triggery();
    const resolveId = asFn(plugin.resolveId);
    const result = resolveId?.call(
      plugin as never,
      '/some/random/module.ts',
      undefined,
      {} as never,
    );
    expect(result).toBeNull();
  });

  it('load emits one import per matched trigger file (sorted)', async () => {
    const plugin = withRoot(triggery({ glob: 'fixtures/triggers/*.trigger.ts' }), here);
    const load = asFn(plugin.load);
    const code = (await load?.call(plugin as never, '\0virtual:triggery-registry', undefined)) as
      | string
      | undefined;
    expect(code).toBeDefined();
    expect(code).toContain(JSON.stringify(path.join(fixturesRoot, 'triggers', 'alpha.trigger.ts')));
    expect(code).toContain(JSON.stringify(path.join(fixturesRoot, 'triggers', 'beta.trigger.ts')));
    expect(code).not.toContain('not-a-trigger.ts');
    // Deterministic order
    const alphaIdx = code!.indexOf('alpha.trigger.ts');
    const betaIdx = code!.indexOf('beta.trigger.ts');
    expect(alphaIdx).toBeLessThan(betaIdx);
    // Always ends with an export so it's a valid ES module.
    expect(code).toMatch(/export\s*\{\s*\}\s*;?\s*$/);
  });

  it('load returns a placeholder body when no files match', async () => {
    const plugin = withRoot(triggery({ glob: 'no-such-dir/**/*.trigger.ts' }), here);
    const load = asFn(plugin.load);
    const code = (await load?.call(plugin as never, '\0virtual:triggery-registry', undefined)) as
      | string
      | undefined;
    expect(code).toContain('no *.trigger.* files matched');
    expect(code).toContain('export {}');
  });

  it('load returns null for any other id', async () => {
    const plugin = triggery();
    const load = asFn(plugin.load);
    const result = await load?.call(plugin as never, '/some/other/module.ts', undefined);
    expect(result).toBeNull();
  });
});

describe('@triggery/vite — handleHotUpdate', () => {
  it('invalidates the virtual module when a trigger file is touched', () => {
    const plugin = triggery();
    const handleHotUpdate = asFn(plugin.handleHotUpdate);
    expect(handleHotUpdate).toBeDefined();
    const invalidateModule = vi.fn();
    const mod = { id: '\0virtual:triggery-registry' };
    const server = {
      moduleGraph: {
        getModuleById: vi.fn().mockReturnValue(mod),
        invalidateModule,
      },
    };
    handleHotUpdate?.call(
      plugin as never,
      stubHmrCtx('/abs/path/src/feature/foo.trigger.ts', server),
    );
    expect(server.moduleGraph.getModuleById).toHaveBeenCalledWith('\0virtual:triggery-registry');
    expect(invalidateModule).toHaveBeenCalledWith(mod);
  });

  it('does nothing for non-trigger files', () => {
    const plugin = triggery();
    const handleHotUpdate = asFn(plugin.handleHotUpdate);
    const invalidateModule = vi.fn();
    const server = {
      moduleGraph: {
        getModuleById: vi.fn().mockReturnValue({ id: '\0virtual:triggery-registry' }),
        invalidateModule,
      },
    };
    handleHotUpdate?.call(plugin as never, stubHmrCtx('/abs/path/src/feature/foo.tsx', server));
    expect(invalidateModule).not.toHaveBeenCalled();
  });

  it('does not crash if the virtual module is not yet in the graph', () => {
    const plugin = triggery();
    const handleHotUpdate = asFn(plugin.handleHotUpdate);
    const server = {
      moduleGraph: {
        getModuleById: vi.fn().mockReturnValue(undefined),
        invalidateModule: vi.fn(),
      },
    };
    expect(() =>
      handleHotUpdate?.call(plugin as never, stubHmrCtx('/abs/path/src/x.trigger.ts', server)),
    ).not.toThrow();
    expect(server.moduleGraph.invalidateModule).not.toHaveBeenCalled();
  });
});
