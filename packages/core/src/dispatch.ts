import { withDispatch } from './cascadeContext.ts';
import { createCheck } from './check.ts';
import type { InspectorImpl } from './inspector.ts';
import type {
  ActionContext,
  ConcurrencyStrategy,
  ConditionGetter,
  FireContext,
  InternalHandlerCtx,
  InternalTriggerConfig,
  Middleware,
  SkipContext,
  UntypedActionFn,
} from './types.ts';

let runIdCounter = 0;
const genRunId = () => `run_${(++runIdCounter).toString(36)}`;

/**
 * Whether any middleware in the list cares about per-run / per-action timing.
 * When nothing observes timing we skip every `performance.now()` call in the
 * hot path (this avoids one syscall-per-trigger on CodSpeed Valgrind runs).
 */
function needsTiming(middleware: readonly Middleware[]): boolean {
  for (const mw of middleware) {
    if (mw.onActionEnd || mw.onError || mw.onActionStart) return true;
  }
  return false;
}

const nowMs = (): number => Date.now();

/**
 * Timer state for the `debounce / throttle / defer` action wrappers.
 * Stored on `RegisteredTrigger.timers` so that calls survive across runs and
 * can be cancelled on dispose.
 */
export type TimerEntry =
  | { kind: 'debounce'; tid: ReturnType<typeof setTimeout> }
  | { kind: 'throttle'; lastFiredAt: number }
  | { kind: 'defer'; tid: ReturnType<typeof setTimeout> };

export type RegisteredTrigger = {
  readonly config: InternalTriggerConfig;
  /** Top-of-stack mirror of `conditionStacks` — kept in sync by runtime so dispatch reads a flat Map. */
  readonly conditions: Map<string, ConditionGetter>;
  /** Top-of-stack mirror of `actionStacks`. */
  readonly actions: Map<string, UntypedActionFn>;
  /** Full registration stacks (last-mount-wins, StrictMode-safe). @internal */
  readonly conditionStacks: Map<string, ConditionGetter[]>;
  readonly actionStacks: Map<string, UntypedActionFn[]>;
  enabled: boolean;
  /** Active runs. `take-latest` aborts all, `take-every`/`queue` keeps them. */
  readonly inFlight: Set<AbortController>;
  /** Tail promise for the `queue` strategy — every new run chains onto this. */
  queueTail: Promise<void>;
  /** Active debounce/throttle/defer timers, keyed by `${kind}:${action}:${ms|counter}`. */
  readonly timers: Map<string, TimerEntry>;
  /** Monotonic counter for unique `defer` timer keys. */
  deferCounter: number;
};

type DispatchDeps = {
  trigger: RegisteredTrigger;
  fireCtx: FireContext;
  inspector: InspectorImpl;
  middleware: readonly Middleware[];
  /** Runtime id — passed into the cascade context so cross-runtime fires don't get tagged as cascade. */
  runtimeId: string;
};

/**
 * Cancel and drop every pending timer for a trigger. Called on dispose so we
 * don't leak setTimeout handles or invoke handlers after the trigger is gone.
 */
export function cancelAllTimers(trigger: RegisteredTrigger): void {
  for (const entry of trigger.timers.values()) {
    if (entry.kind === 'debounce' || entry.kind === 'defer') {
      clearTimeout(entry.tid);
    }
  }
  trigger.timers.clear();
}

/**
 * Invoke a single action handler with middleware tracking. Used both for
 * inline calls during a run and for deferred (debounced / throttled / defer)
 * calls that fire outside the original run.
 */
function invokeAction(
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

/**
 * Public entry point. Runs the concurrency gate first (which can skip or queue
 * the run), then enters the actual handler in `runHandler`.
 */
export function executeTrigger(deps: DispatchDeps): void | Promise<void> {
  const { trigger } = deps;
  if (!trigger.enabled) return;

  const concurrency: ConcurrencyStrategy = trigger.config.concurrency ?? 'take-latest';

  if (concurrency === 'queue') {
    // Serialize subsequent runs onto the tail. The catch ensures one failing
    // handler doesn't poison the chain for later runs.
    trigger.queueTail = trigger.queueTail.then(() => runHandler(deps, concurrency)).catch(() => {});
    return;
  }

  return runHandler(deps, concurrency);
}

function runHandler(deps: DispatchDeps, concurrency: ConcurrencyStrategy): void | Promise<void> {
  const { trigger, fireCtx, inspector, middleware, runtimeId } = deps;
  if (!trigger.enabled) return;

  const trackTiming = needsTiming(middleware);

  // ─── Concurrency gate ────────────────────────────────────────────────────
  // take-first / exhaust: if anything is in flight, skip this run.
  if (concurrency === 'take-first' || concurrency === 'exhaust') {
    if (trigger.inFlight.size > 0) {
      const runId = genRunId();
      const reason = `concurrency-${concurrency}`;
      const skipCtx: SkipContext = {
        triggerId: trigger.config.id,
        eventName: fireCtx.eventName,
        reason,
      };
      for (const mw of middleware) mw.onSkip?.(skipCtx);
      inspector.record({
        triggerId: trigger.config.id,
        runId,
        eventName: fireCtx.eventName,
        status: 'skipped',
        reason,
        durationMs: 0,
        executedActions: [],
        snapshotKeys: [],
      });
      return;
    }
  }

  // take-latest: abort everything still in flight.
  if (concurrency === 'take-latest') {
    for (const prev of trigger.inFlight) prev.abort('superseded-by-latest');
    trigger.inFlight.clear();
  }

  // ─── Run setup ──────────────────────────────────────────────────────────
  const runId = genRunId();
  const startedAt = trackTiming ? performance.now() : 0;
  const executedActions: string[] = [];
  const snapshotKeys: string[] = [];

  // Required gate — every required condition must be registered.
  for (const requiredName of trigger.config.required) {
    if (!trigger.conditions.has(requiredName)) {
      const reason = `missing-required-condition:${requiredName}`;
      const skipCtx: SkipContext = {
        triggerId: trigger.config.id,
        eventName: fireCtx.eventName,
        reason,
      };
      for (const mw of middleware) mw.onSkip?.(skipCtx);
      inspector.record({
        triggerId: trigger.config.id,
        runId,
        eventName: fireCtx.eventName,
        status: 'skipped',
        reason,
        durationMs: trackTiming ? performance.now() - startedAt : 0,
        executedActions: [],
        snapshotKeys: [],
      });
      return;
    }
  }

  // Conditions snapshot — lazy proxy with a cache.
  const snapshotCache = new Map<string, unknown>();
  const conditionsProxy = new Proxy({} as Record<string, unknown>, {
    get(_target, prop: string | symbol) {
      if (typeof prop !== 'string') return undefined;
      if (snapshotCache.has(prop)) return snapshotCache.get(prop);
      const getter = trigger.conditions.get(prop);
      if (!getter) {
        snapshotCache.set(prop, undefined);
        return undefined;
      }
      const value = getter();
      snapshotCache.set(prop, value);
      snapshotKeys.push(prop);
      return value;
    },
    has(_target, prop) {
      return typeof prop === 'string' && trigger.conditions.has(prop);
    },
    ownKeys() {
      return Array.from(trigger.conditions.keys());
    },
    getOwnPropertyDescriptor() {
      return { enumerable: true, configurable: true };
    },
  });

  // ─── Action proxy + timing wrappers ──────────────────────────────────────
  const callActionImmediate = (name: string, payload: unknown): void => {
    const handler = trigger.actions.get(name);
    if (!handler) return;
    executedActions.push(name);
    invokeAction(
      handler,
      { triggerId: trigger.config.id, runId, actionName: name, payload },
      middleware,
      trackTiming,
    );
  };

  /** Invocation triggered by a debounce/throttle/defer timer — late binding. */
  const callActionDeferred = (name: string, payload: unknown): void => {
    if (!trigger.enabled) return;
    const handler = trigger.actions.get(name);
    if (!handler) return;
    invokeAction(
      handler,
      { triggerId: trigger.config.id, runId, actionName: name, payload },
      middleware,
      trackTiming,
    );
  };

  const buildTimedProxy = (kind: 'debounce' | 'throttle' | 'defer', ms: number) =>
    new Proxy({} as Record<string, unknown>, {
      get(_target, prop: string | symbol) {
        if (typeof prop !== 'string') return undefined;
        if (!trigger.actions.has(prop)) return undefined;
        return (payload?: unknown) => {
          if (kind === 'debounce') {
            const key = `debounce:${prop}:${ms}`;
            const existing = trigger.timers.get(key);
            if (existing?.kind === 'debounce') clearTimeout(existing.tid);
            const tid = setTimeout(() => {
              trigger.timers.delete(key);
              callActionDeferred(prop, payload);
            }, ms);
            trigger.timers.set(key, { kind: 'debounce', tid });
          } else if (kind === 'throttle') {
            // Leading-edge throttle: fire immediately, then drop calls until
            // `ms` has elapsed. Trailing-edge variant lands in V1.1.
            const key = `throttle:${prop}:${ms}`;
            const existing = trigger.timers.get(key);
            const now = nowMs();
            if (existing?.kind === 'throttle' && now - existing.lastFiredAt < ms) return;
            trigger.timers.set(key, { kind: 'throttle', lastFiredAt: now });
            callActionDeferred(prop, payload);
          } else {
            const key = `defer:${prop}:${++trigger.deferCounter}`;
            const tid = setTimeout(() => {
              trigger.timers.delete(key);
              callActionDeferred(prop, payload);
            }, ms);
            trigger.timers.set(key, { kind: 'defer', tid });
          }
        };
      },
      has(_target, prop) {
        return typeof prop === 'string' && trigger.actions.has(prop);
      },
    });

  const actionsProxy = new Proxy({} as InternalHandlerCtx['actions'], {
    get(_target, prop: string | symbol) {
      if (prop === 'debounce') return (ms: number) => buildTimedProxy('debounce', ms);
      if (prop === 'throttle') return (ms: number) => buildTimedProxy('throttle', ms);
      if (prop === 'defer') return (ms: number) => buildTimedProxy('defer', ms);
      if (typeof prop !== 'string') return undefined;
      if (!trigger.actions.has(prop)) return undefined;
      return (payload: unknown) => callActionImmediate(prop, payload);
    },
    has(_target, prop) {
      return typeof prop === 'string' && trigger.actions.has(prop);
    },
  });

  // ─── Abort controller + cascade context ──────────────────────────────────
  const controller = new AbortController();
  trigger.inFlight.add(controller);

  // The cascade chain visible to nested `fire` calls includes this trigger.
  const nextVisited = new Set(fireCtx.visitedChain ?? []);
  nextVisited.add(trigger.config.id);

  const handlerCtx: InternalHandlerCtx = {
    event: { name: fireCtx.eventName, payload: fireCtx.payload },
    conditions: conditionsProxy,
    actions: actionsProxy,
    check: createCheck(conditionsProxy),
    meta: {
      runId,
      triggerId: trigger.config.id,
      scheduledAt: startedAt,
      cascadeDepth: fireCtx.cascadeDepth,
      ...(fireCtx.parentRunId !== undefined && { parentRunId: fireCtx.parentRunId }),
      ...(fireCtx.parentTriggerId !== undefined && { parentTriggerId: fireCtx.parentTriggerId }),
    },
    signal: controller.signal,
  };

  const finalize = (status: 'fired' | 'errored' | 'aborted', reason?: string) => {
    trigger.inFlight.delete(controller);
    inspector.record({
      triggerId: trigger.config.id,
      runId,
      eventName: fireCtx.eventName,
      status,
      ...(reason !== undefined && { reason }),
      durationMs: trackTiming ? performance.now() - startedAt : 0,
      executedActions,
      snapshotKeys,
    });
  };

  // Invoke the handler. The synchronous prologue runs inside `withDispatch`,
  // so any `runtime.fire` called from it (or from sync actions) sees the
  // cascade context.
  try {
    const result = withDispatch(
      {
        runtimeId,
        triggerId: trigger.config.id,
        runId,
        cascadeDepth: fireCtx.cascadeDepth,
        visitedChain: nextVisited,
      },
      () => trigger.config.handler(handlerCtx),
    );
    if (result && typeof (result as Promise<void>).then === 'function') {
      return (result as Promise<void>).then(
        () => finalize('fired'),
        (error: unknown) => {
          if (controller.signal.aborted) {
            finalize('aborted', String(controller.signal.reason ?? 'aborted'));
            return;
          }
          // eslint-disable-next-line no-console -- last line of defence
          console.error(`[triggery] handler "${trigger.config.id}" failed:`, error);
          finalize('errored', String(error));
        },
      );
    }
    finalize('fired');
  } catch (error) {
    // eslint-disable-next-line no-console -- last line of defence
    console.error(`[triggery] handler "${trigger.config.id}" failed:`, error);
    finalize('errored', String(error));
  }
  return undefined;
}
