/**
 * Inspector subpath — `@triggery/core/inspect`.
 *
 * The ring-buffer `createInspector` and the noop fallback live here so that
 * apps which run with `inspector: false` (or that explicitly opt in via
 * the factory pattern) can keep the per-run snapshot machinery out of the
 * main bundle.
 *
 * Usage (recommended for v0.10+):
 *
 * ```ts
 * import { createRuntime } from '@triggery/core';
 * import { createInspectorFactory } from '@triggery/core/inspect';
 *
 * const runtime = createRuntime({ inspector: createInspectorFactory() });
 * ```
 *
 * For backwards compatibility `createRuntime({ inspector: true })` continues
 * to work — the main entry still references `createInspector` directly when
 * the boolean opt-in is used. The factory pattern is what gets cleanly
 * tree-shaken once a future release flips the default to noop.
 */

import type { InspectorImpl } from './inspector.ts';
import { createInspector } from './inspector.ts';

export type { InspectorImpl } from './inspector.ts';
export { createInspector, createNoopInspector } from './inspector.ts';

/**
 * Build an inspector factory — a function that the runtime calls with the
 * configured buffer size and that returns a live `InspectorImpl`. Passing
 * the factory through `createRuntime({ inspector })` is the bundle-friendly
 * way to opt in to per-run snapshots.
 */
export function createInspectorFactory(): (bufferSize: number) => InspectorImpl {
  return (bufferSize) => createInspector(bufferSize);
}
