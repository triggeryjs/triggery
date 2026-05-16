import { createCheck } from './check.ts';
import type { InspectorImpl } from './inspector.ts';
import type {
  ActionContext,
  ConditionGetter,
  FireContext,
  InternalHandlerCtx,
  InternalTriggerConfig,
  Middleware,
  SkipContext,
  TriggerInspectSnapshot,
  UntypedActionFn,
} from './types.ts';

let runIdCounter = 0;
const genRunId = () => `run_${Date.now().toString(36)}_${(++runIdCounter).toString(36)}`;

export type RegisteredTrigger = {
  readonly config: InternalTriggerConfig;
  readonly conditions: Map<string, ConditionGetter>;
  readonly actions: Map<string, UntypedActionFn>;
  enabled: boolean;
  inFlight: AbortController | undefined;
};

type DispatchDeps = {
  trigger: RegisteredTrigger;
  fireCtx: FireContext;
  inspector: InspectorImpl;
  middleware: readonly Middleware[];
  /** Lets the handler emit a cascade fire. */
  cascadeFire: (eventName: string, payload: unknown, parentRunId: string) => void;
};

/** Cheap no-op AbortController for sync handlers. */
const noopAbortController = (): AbortController => new AbortController();

export function executeTrigger(deps: DispatchDeps): void | Promise<void> {
  const { trigger, fireCtx, inspector, middleware } = deps;
  if (!trigger.enabled) return;

  const runId = genRunId();
  const startedAt = performance.now();
  const executedActions: string[] = [];
  const snapshotKeys: string[] = [];

  // 1) Required gate — every required condition must be registered.
  for (const requiredName of trigger.config.required) {
    if (!trigger.conditions.has(requiredName)) {
      const skipCtx: SkipContext = {
        triggerId: trigger.config.id,
        eventName: fireCtx.eventName,
        reason: `missing-required-condition:${requiredName}`,
      };
      for (const mw of middleware) mw.onSkip?.(skipCtx);
      const snapshot: TriggerInspectSnapshot = {
        triggerId: trigger.config.id,
        runId,
        eventName: fireCtx.eventName,
        status: 'skipped',
        reason: skipCtx.reason,
        durationMs: performance.now() - startedAt,
        executedActions: [],
        snapshotKeys: [],
      };
      inspector.record(snapshot);
      return;
    }
  }

  // 2) Conditions snapshot — lazy proxy with a cache.
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

  // 3) Actions proxy — all entries optional, chainable debounce/throttle (V1: stubs).
  const buildActionsProxy = (): InternalHandlerCtx['actions'] => {
    const callAction = (name: string, payload: unknown) => {
      const handler = trigger.actions.get(name);
      if (!handler) return;
      executedActions.push(name);
      const actionCtx: ActionContext = {
        triggerId: trigger.config.id,
        runId,
        actionName: name,
        payload,
      };
      const actionStart = performance.now();
      for (const mw of middleware) mw.onActionStart?.(actionCtx);
      try {
        const result = handler(payload);
        if (result && typeof (result as Promise<unknown>).then === 'function') {
          (result as Promise<unknown>).then(
            (value) => {
              for (const mw of middleware) {
                mw.onActionEnd?.({
                  ...actionCtx,
                  durationMs: performance.now() - actionStart,
                  result: value,
                });
              }
            },
            (error) => {
              for (const mw of middleware) mw.onError?.({ ...actionCtx, error });
            },
          );
        } else {
          for (const mw of middleware) {
            mw.onActionEnd?.({
              ...actionCtx,
              durationMs: performance.now() - actionStart,
              result,
            });
          }
        }
      } catch (error) {
        for (const mw of middleware) mw.onError?.({ ...actionCtx, error });
      }
    };

    const proxy = new Proxy({} as InternalHandlerCtx['actions'], {
      get(_target, prop: string | symbol) {
        if (prop === 'debounce' || prop === 'throttle' || prop === 'defer') {
          // V1: returns the same proxy without applying timing. Real wrappers land in V1.1.
          return (_ms: number) => proxy;
        }
        if (typeof prop !== 'string') return undefined;
        if (!trigger.actions.has(prop)) return undefined;
        return (payload: unknown) => callAction(prop, payload);
      },
      has(_target, prop) {
        return typeof prop === 'string' && trigger.actions.has(prop);
      },
    });
    return proxy;
  };

  // 4) AbortSignal — take-latest for async handlers.
  trigger.inFlight?.abort('superseded-by-latest');
  const controller = noopAbortController();
  trigger.inFlight = controller;

  // 5) Build the handler context.
  const handlerCtx: InternalHandlerCtx = {
    event: { name: fireCtx.eventName, payload: fireCtx.payload },
    conditions: conditionsProxy,
    actions: buildActionsProxy(),
    check: createCheck(conditionsProxy),
    meta: {
      runId,
      triggerId: trigger.config.id,
      scheduledAt: startedAt,
      cascadeDepth: fireCtx.cascadeDepth,
      ...(fireCtx.parentRunId !== undefined && { parentRunId: fireCtx.parentRunId }),
    },
    signal: controller.signal,
  };

  const finalize = (status: 'fired' | 'errored' | 'aborted', reason?: string) => {
    if (trigger.inFlight === controller) trigger.inFlight = undefined;
    const snapshot: TriggerInspectSnapshot = {
      triggerId: trigger.config.id,
      runId,
      eventName: fireCtx.eventName,
      status,
      ...(reason !== undefined && { reason }),
      durationMs: performance.now() - startedAt,
      executedActions,
      snapshotKeys,
    };
    inspector.record(snapshot);
  };

  // 6) Invoke the handler — sync or async.
  try {
    const result = trigger.config.handler(handlerCtx);
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
