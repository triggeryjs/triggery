/**
 * Internal dispatch helpers — extracted from `dispatch.ts` so the middleware
 * traversal loops, snapshot bookkeeping primitives and shared utilities can
 * be reused (and, in future minor releases, split between a plain and a
 * middleware-aware dispatch entry point with separate tree-shake boundaries).
 *
 * This module is internal — not re-exported from the package entry point.
 */

import type { ActionContext, Middleware, UntypedActionFn } from './types.ts';

let runIdCounter = 0;
export const genRunId = (): string => `run_${(++runIdCounter).toString(36)}`;

/** Shared frozen empty array — reused by skip/short-circuit paths to avoid alloc. */
export const EMPTY_STRING_ARRAY: readonly string[] = Object.freeze([]) as readonly string[];

/**
 * Invoke a single action handler with middleware tracking. Used both for
 * inline calls during a run and for deferred (debounced / throttled / defer)
 * calls that fire outside the original run.
 */
export function invokeAction(
  handler: UntypedActionFn,
  ctx: ActionContext,
  middleware: readonly Middleware[],
  trackTiming: boolean,
): void {
  const startedAt = trackTiming ? performance.now() : 0;
  for (const mw of middleware) mw.onActionStart?.(ctx);
  try {
    const result = handler(ctx.payload);
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      (result as Promise<unknown>).then(
        (value) => {
          for (const mw of middleware) {
            mw.onActionEnd?.({
              ...ctx,
              durationMs: trackTiming ? performance.now() - startedAt : 0,
              result: value,
            });
          }
        },
        (error) => {
          for (const mw of middleware) mw.onError?.({ ...ctx, error });
        },
      );
    } else {
      for (const mw of middleware) {
        mw.onActionEnd?.({
          ...ctx,
          durationMs: trackTiming ? performance.now() - startedAt : 0,
          result,
        });
      }
    }
  } catch (error) {
    for (const mw of middleware) mw.onError?.({ ...ctx, error });
  }
}
