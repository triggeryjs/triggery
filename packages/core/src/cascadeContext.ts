/**
 * Module-level dispatch context for cascade tracking.
 *
 * When a handler (or any of its actions) synchronously calls `runtime.fire` or
 * `runtime.fireSync`, the runtime needs to know "this fire happens INSIDE a
 * running trigger" — that's a cascade, not a top-level emit. The current
 * dispatch context is set right before the handler runs and restored after it
 * returns (synchronously).
 *
 * Internally each context links to its parent (the trigger that fired the
 * cascade ancestor). Cycle detection walks the chain via `chainHas` — O(depth)
 * instead of allocating a new `Set` on every fire to mimic the same behaviour.
 *
 * V1 limitation: cascade tracking only follows the synchronous part of an
 * async handler. After the first `await`, the context is restored to the
 * caller's frame and any subsequent `fire` is treated as a fresh top-level
 * emit. This matches what's documented in `package README → cascade` and is
 * acknowledged in the brainstorm risk register (item #21).
 */

export type DispatchContext = {
  readonly runtimeId: string;
  readonly triggerId: string;
  readonly runId: string;
  readonly cascadeDepth: number;
  /** The parent context (the dispatch that called `fire` from inside a handler). */
  readonly parent: DispatchContext | null;
};

let current: DispatchContext | null = null;

export function getCurrentDispatch(): DispatchContext | null {
  return current;
}

/**
 * Run `fn` with `ctx` as the active dispatch context. The previous context is
 * restored on return — works for sync execution and the synchronous prologue
 * of async handlers.
 */
export function withDispatch<T>(ctx: DispatchContext, fn: () => T): T {
  const prev = current;
  current = ctx;
  try {
    return fn();
  } finally {
    current = prev;
  }
}

/**
 * Walk the parent chain looking for a given trigger id. Used by the runtime
 * to detect cascade cycles without ever building a Set on the hot path.
 */
export function chainHas(ctx: DispatchContext | null | undefined, triggerId: string): boolean {
  let cur = ctx ?? null;
  while (cur) {
    if (cur.triggerId === triggerId) return true;
    cur = cur.parent;
  }
  return false;
}
