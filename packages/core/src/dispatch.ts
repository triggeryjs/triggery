import { type DispatchContext, withDispatch } from './cascadeContext.ts';
import { createCheck } from './check.ts';
import { EMPTY_STRING_ARRAY, genRunId, invokeAction } from './dispatch-helpers.ts';
import type { InspectorImpl } from './inspector.ts';
import {
  buildTimedActionsProxy,
  cancelAllTimers as cancelAllTimersImpl,
  type TimerEntry as TimerEntryImpl,
} from './timers.ts';
import type {
  ConcurrencyStrategy,
  ConditionGetter,
  FireContext,
  InternalHandlerCtx,
  InternalTriggerConfig,
  Middleware,
  SkipContext,
  TriggerInspectSnapshot,
  UntypedActionFn,
} from './types.ts';

/**
 * Whether any middleware in the list cares about per-run / per-action timing.
 * Cached once at runtime construction — avoids one for-of per fire.
 */
export function needsTiming(middleware: readonly Middleware[]): boolean {
  for (const mw of middleware) {
    if (mw.onActionEnd || mw.onError || mw.onActionStart) return true;
  }
  return false;
}

/** Re-exported for backwards compatibility — the canonical home is `./timers`. */
export type TimerEntry = TimerEntryImpl;

export type RegisteredTrigger = {
  readonly config: InternalTriggerConfig;
  /** Top-of-stack mirror of `conditionStacks` — kept in sync by runtime so dispatch reads a flat Map. */
  readonly conditions: Map<string, ConditionGetter>;
  /** Top-of-stack mirror of `actionStacks`. */
  readonly actions: Map<string, UntypedActionFn>;
  /** Full registration stacks (last-mount-wins, StrictMode-safe). @internal */
  readonly conditionStacks: Map<string, ConditionGetter[]>;
  readonly actionStacks: Map<string, UntypedActionFn[]>;
  /**
   * Additive fan-out subscribers per action name (v0.10+ action-channel path).
   * Invoked on every action emit in addition to the top-of-stack action handler
   * registered via `runtime.registerAction`. Empty for triggers that never used
   * the action-channel API.
   */
  readonly channelSubscribers: Map<string, Set<UntypedActionFn>>;
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
  /**
   * Whether the runtime's inspector is active. When `false` we skip building
   * the per-run snapshot object, skip the executedActions / snapshotKeys
   * tracking, and avoid the `inspector.record(...)` call entirely.
   */
  inspectorEnabled: boolean;
  middleware: readonly Middleware[];
  /** Cached `middleware.length > 0` — saves a `.length` access per fire. */
  hasMiddleware: boolean;
  /** Cached `needsTiming(middleware)` — saves a per-fire for-of through middleware. */
  trackTiming: boolean;
  /** Runtime id — passed into the cascade context so cross-runtime fires don't get tagged as cascade. */
  runtimeId: string;
};

/**
 * Cancel and drop every pending timer for a trigger. Called on dispose so we
 * don't leak setTimeout handles or invoke handlers after the trigger is gone.
 *
 * Thin wrapper over `cancelAllTimers` from `./timers` so the heavy timer
 * machinery can be loaded lazily.
 */
export function cancelAllTimers(trigger: RegisteredTrigger): void {
  cancelAllTimersImpl(trigger);
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
  const {
    trigger,
    fireCtx,
    inspector,
    inspectorEnabled,
    middleware,
    hasMiddleware,
    trackTiming,
    runtimeId,
  } = deps;
  if (!trigger.enabled) return;

  // ─── Middleware: onBeforeMatch ───────────────────────────────────────────
  // Fires once per (event, trigger) pair, before any concurrency/required
  // gate runs. Purely observational — middleware that wants to cancel should
  // do it from `onFire` instead.
  if (hasMiddleware) {
    const matchCtx = {
      triggerId: trigger.config.id,
      eventName: fireCtx.eventName,
      payload: fireCtx.payload,
      cascadeDepth: fireCtx.cascadeDepth,
    } as const;
    for (const mw of middleware) mw.onBeforeMatch?.(matchCtx);
  }

  // ─── Concurrency gate ────────────────────────────────────────────────────
  // take-first / exhaust: if anything is in flight, skip this run.
  if (concurrency === 'take-first' || concurrency === 'exhaust') {
    if (trigger.inFlight.size > 0) {
      const reason = `concurrency-${concurrency}`;
      if (hasMiddleware) {
        const skipCtx: SkipContext = {
          triggerId: trigger.config.id,
          eventName: fireCtx.eventName,
          reason,
        };
        for (const mw of middleware) mw.onSkip?.(skipCtx);
      }
      if (inspectorEnabled) {
        inspector.record({
          triggerId: trigger.config.id,
          runId: genRunId(),
          eventName: fireCtx.eventName,
          status: 'skipped',
          reason,
          durationMs: 0,
          executedActions: EMPTY_STRING_ARRAY,
          snapshotKeys: EMPTY_STRING_ARRAY,
        });
      }
      return;
    }
  }

  // take-latest: abort everything still in flight.
  if (concurrency === 'take-latest' && trigger.inFlight.size > 0) {
    for (const prev of trigger.inFlight) prev.abort('superseded-by-latest');
    trigger.inFlight.clear();
  }

  // ─── Run setup ──────────────────────────────────────────────────────────
  const runId = genRunId();
  // performance.now() is only needed when either the inspector wants a
  // durationMs or middleware observes per-action timing.
  const needDuration = inspectorEnabled || trackTiming;
  const startedAt = needDuration ? performance.now() : 0;

  // Required gate — every required condition must be registered. This check
  // hits `trigger.conditions` (the mirror Map) directly, not the lazy proxy,
  // so it stays cheap even when nothing else in the handler runs.
  const required = trigger.config.required;
  if (required.length > 0) {
    for (let i = 0; i < required.length; i++) {
      const requiredName = required[i] as string;
      if (!trigger.conditions.has(requiredName)) {
        const reason = `missing-required-condition:${requiredName}`;
        if (hasMiddleware) {
          const skipCtx: SkipContext = {
            triggerId: trigger.config.id,
            eventName: fireCtx.eventName,
            reason,
          };
          for (const mw of middleware) mw.onSkip?.(skipCtx);
        }
        if (inspectorEnabled) {
          inspector.record({
            triggerId: trigger.config.id,
            runId,
            eventName: fireCtx.eventName,
            status: 'skipped',
            reason,
            durationMs: needDuration ? performance.now() - startedAt : 0,
            executedActions: EMPTY_STRING_ARRAY,
            snapshotKeys: EMPTY_STRING_ARRAY,
          });
        }
        return;
      }
    }
  }

  // Snapshot bookkeeping — only allocated when the inspector wants them. When
  // the inspector is off we point both arrays at a shared frozen empty array
  // and gate every `push` behind `inspectorEnabled`. Saves two allocations and
  // all per-condition/per-action pushes on the hot path.
  const executedActions: string[] = inspectorEnabled ? [] : (EMPTY_STRING_ARRAY as string[]);
  const snapshotKeys: string[] = inspectorEnabled ? [] : (EMPTY_STRING_ARRAY as string[]);

  // Conditions snapshot — lazy proxy with a cache (consistency guarantee:
  // a handler reading the same condition twice in one run sees the same value).
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
      if (inspectorEnabled) snapshotKeys.push(prop);
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
  // Invoke an action: top-of-stack handler (if any) AND every channel
  // subscriber (if any). `recordExecution` differentiates immediate calls
  // (track for the inspector) from deferred timer invocations.
  const dispatchAction = (name: string, payload: unknown, recordExecution: boolean): void => {
    if (!trigger.enabled) return;
    const handler = trigger.actions.get(name);
    const subscribers = trigger.channelSubscribers.get(name);
    if (!handler && (!subscribers || subscribers.size === 0)) return;
    if (recordExecution && inspectorEnabled) executedActions.push(name);
    const actionCtx = { triggerId: trigger.config.id, runId, actionName: name, payload };
    if (handler) invokeAction(handler, actionCtx, middleware, trackTiming);
    if (subscribers) {
      for (const cb of subscribers) invokeAction(cb, actionCtx, middleware, trackTiming);
    }
  };

  const callActionDeferred = (name: string, payload: unknown): void => {
    dispatchAction(name, payload, false);
  };

  const hasActionTarget = (name: string): boolean =>
    trigger.actions.has(name) || (trigger.channelSubscribers.get(name)?.size ?? 0) > 0;

  const buildTimedProxy = (kind: 'debounce' | 'throttle' | 'defer', ms: number) =>
    buildTimedActionsProxy({
      kind,
      ms,
      carrier: trigger,
      hasTarget: hasActionTarget,
      callDeferred: callActionDeferred,
    });

  const actionsProxy = new Proxy({} as InternalHandlerCtx['actions'], {
    get(_target, prop: string | symbol) {
      if (prop === 'debounce') return (ms: number) => buildTimedProxy('debounce', ms);
      if (prop === 'throttle') return (ms: number) => buildTimedProxy('throttle', ms);
      if (prop === 'defer') return (ms: number) => buildTimedProxy('defer', ms);
      if (typeof prop !== 'string') return undefined;
      if (!hasActionTarget(prop)) return undefined;
      return (payload: unknown) => dispatchAction(prop, payload, true);
    },
    has(_target, prop) {
      return typeof prop === 'string' && hasActionTarget(prop);
    },
  });

  // ─── Abort controller + handler ctx ──────────────────────────────────────
  const controller = new AbortController();
  trigger.inFlight.add(controller);

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
    if (!inspectorEnabled) return;
    // Build the snapshot without the `...(reason && {reason})` spread —
    // the spread allocates two intermediate objects per fire on the hot path.
    const snapshot: { -readonly [K in keyof TriggerInspectSnapshot]: TriggerInspectSnapshot[K] } = {
      triggerId: trigger.config.id,
      runId,
      eventName: fireCtx.eventName,
      status,
      durationMs: needDuration ? performance.now() - startedAt : 0,
      executedActions,
      snapshotKeys,
    };
    if (reason !== undefined) snapshot.reason = reason;
    inspector.record(snapshot);
  };

  // Invoke the handler. The synchronous prologue runs inside `withDispatch`,
  // so any `runtime.fire` called from it (or from sync actions) sees the
  // cascade context. The parent chain is a linked list — no Set allocation
  // per fire; cycle checks walk the chain.
  try {
    const result = withDispatch(
      {
        runtimeId,
        triggerId: trigger.config.id,
        runId,
        cascadeDepth: fireCtx.cascadeDepth,
        parent: (fireCtx.parentContext as DispatchContext | undefined) ?? null,
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
