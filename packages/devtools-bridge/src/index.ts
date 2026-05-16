/**
 * @triggery/devtools-bridge — make a runtime observable to external tools.
 *
 * Install once per runtime in DEV builds. The bridge:
 *   1. Stamps a discovery object onto `window[globalKey]` so tools can
 *      detect that the page has Triggery running and read the runtime id.
 *   2. Broadcasts an initial `triggery:hello` message with the current
 *      graph + inspector buffer (so a panel opened mid-session has data).
 *   3. Subscribes to the runtime and broadcasts every new inspector
 *      snapshot as `triggery:snapshot`.
 *
 * Messages are sent via `window.postMessage(..., '*')` with a stable
 * `source` field, which the Chrome extension's content script listens
 * for. Same wire format works for a standalone WebSocket-backed panel
 * (planned for V2).
 *
 * @example
 * ```ts
 * import { createRuntime } from '@triggery/core';
 * import { installDevtoolsBridge } from '@triggery/devtools-bridge';
 *
 * const runtime = createRuntime();
 * if (import.meta.env.DEV) installDevtoolsBridge(runtime);
 * ```
 */

import type { Runtime, RuntimeGraph, TriggerInspectSnapshot } from '@triggery/core';

/** Default `source` used in the postMessage envelope. */
export const DEVTOOLS_SOURCE = 'triggery-devtools';
/** Default key on `window` for runtime discovery. */
export const DEVTOOLS_GLOBAL_KEY = '__triggery_devtools__';

export type DevtoolsBridgeOptions = {
  /** Custom discovery key — only override if you need multiple bridges. */
  readonly globalKey?: string;
  /** Custom envelope `source` — must match what the consumer (extension) filters on. */
  readonly source?: string;
};

/** Type of every message we publish. The extension content script switches on this. */
export type DevtoolsMessage =
  | {
      readonly source: string;
      readonly type: 'triggery:hello';
      readonly runtimeId: string;
      readonly graph: RuntimeGraph;
      readonly buffer: readonly TriggerInspectSnapshot[];
      readonly at: number;
    }
  | {
      readonly source: string;
      readonly type: 'triggery:snapshot';
      readonly runtimeId: string;
      readonly snapshot: TriggerInspectSnapshot;
      readonly at: number;
    }
  | {
      readonly source: string;
      readonly type: 'triggery:bye';
      readonly runtimeId: string;
      readonly at: number;
    };

type WindowLike = {
  postMessage(data: unknown, targetOrigin: string): void;
};

type GlobalLike = {
  [key: string]: unknown;
  window?: WindowLike;
};

const getWindow = (): WindowLike | undefined => {
  const g = globalThis as GlobalLike;
  return g.window;
};

/**
 * Install the bridge. Returns a `dispose` function that unsubscribes and
 * removes the discovery key — call it when the runtime itself goes away.
 *
 * Calling `installDevtoolsBridge` on a non-browser environment (Node, SSR)
 * is safe — it returns a no-op disposer.
 */
export function installDevtoolsBridge(
  runtime: Runtime,
  options: DevtoolsBridgeOptions = {},
): () => void {
  const win = getWindow();
  if (!win) return () => {};

  const globalKey = options.globalKey ?? DEVTOOLS_GLOBAL_KEY;
  const source = options.source ?? DEVTOOLS_SOURCE;

  // Discovery handle for extension content scripts. Holds a reference to the
  // live runtime so tools that can reach the main world (e.g. injected
  // scripts) can subscribe directly without postMessage round-trips.
  (globalThis as GlobalLike)[globalKey] = {
    runtime,
    runtimeId: runtime.id,
    source,
    version: 1,
  };

  // Initial hello with the current graph + buffer so a panel opened mid-session
  // sees state immediately.
  win.postMessage(
    {
      source,
      type: 'triggery:hello',
      runtimeId: runtime.id,
      graph: runtime.graph(),
      buffer: runtime.getInspectorBuffer(),
      at: Date.now(),
    } satisfies DevtoolsMessage,
    '*',
  );

  // Per-event stream.
  const token = runtime.subscribe((snapshot) => {
    win.postMessage(
      {
        source,
        type: 'triggery:snapshot',
        runtimeId: runtime.id,
        snapshot,
        at: Date.now(),
      } satisfies DevtoolsMessage,
      '*',
    );
  });

  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    token.unregister();
    delete (globalThis as GlobalLike)[globalKey];
    win.postMessage(
      {
        source,
        type: 'triggery:bye',
        runtimeId: runtime.id,
        at: Date.now(),
      } satisfies DevtoolsMessage,
      '*',
    );
  };
}
