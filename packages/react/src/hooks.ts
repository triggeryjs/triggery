import type {
  ActionKey,
  ActionMap,
  ConditionKey,
  ConditionMap,
  EventKey,
  EventMap,
  Trigger,
  TriggerInspectSnapshot,
  TriggerSchema,
} from '@triggery/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRuntime, useScope } from './context.ts';

/**
 * Return an event emitter. Its identity is stable across renders (`useCallback`
 * under the hood). The trigger must list this event in its `events: [...]` schema
 * passed to `createTrigger`.
 *
 * @example
 * ```tsx
 * const fireNewMessage = useEvent(messageTrigger, 'new-message');
 * useEffect(() => socket.on('msg', fireNewMessage), [fireNewMessage]);
 * ```
 */
export function useEvent<S extends TriggerSchema, K extends EventKey<S>>(
  _trigger: Trigger<S>,
  eventName: K,
): EventMap<S>[K] extends void ? () => void : (payload: EventMap<S>[K]) => void {
  const runtime = useRuntime();
  return useCallback(
    ((payload?: unknown) => {
      runtime.fire(eventName, payload);
    }) as EventMap<S>[K] extends void ? () => void : (payload: EventMap<S>[K]) => void,
    [runtime, eventName],
  );
}

/**
 * Register a condition getter for a trigger. The runtime calls `getter()` at
 * fire-time only — there are no subscriptions and no re-renders.
 *
 * `deps` only invalidate the closure cache (same semantics as `useCallback`).
 *
 * @example
 * ```tsx
 * useCondition(messageTrigger, 'user', () => currentUser, [currentUser]);
 * ```
 */
export function useCondition<S extends TriggerSchema, K extends ConditionKey<S>>(
  trigger: Trigger<S>,
  name: K,
  getter: () => ConditionMap<S>[K],
  deps: readonly unknown[] = [],
): void {
  const runtime = useRuntime();
  const scope = useScope();
  // Keep the latest getter in a ref — the runtime reads through a stable wrapper.
  const getterRef = useRef(getter);
  getterRef.current = getter;
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps managed by caller
  const stableGetter = useCallback(() => getterRef.current(), deps);

  useEffect(() => {
    const token = runtime.registerCondition(trigger.id, name, stableGetter, { scope });
    return () => token.unregister();
  }, [runtime, trigger.id, name, stableGetter, scope]);
}

/**
 * Register an action handler for a trigger. The runtime invokes the handler whenever
 * the trigger body calls `actions.<name>(...)`.
 *
 * @example
 * ```tsx
 * useAction(messageTrigger, 'showToast', (payload) => toast.success(payload.title));
 * ```
 */
export function useAction<S extends TriggerSchema, K extends ActionKey<S>>(
  trigger: Trigger<S>,
  name: K,
  handler: ActionMap<S>[K] extends void
    ? () => void | Promise<void>
    : (payload: ActionMap<S>[K]) => void | Promise<void>,
): void {
  const runtime = useRuntime();
  const scope = useScope();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const token = runtime.registerAction(
      trigger.id,
      name,
      (payload) => (handlerRef.current as (payload: unknown) => void | Promise<void>)(payload),
      { scope },
    );
    return () => token.unregister();
  }, [runtime, trigger.id, name, scope]);
}

/**
 * Return the latest snapshot of a trigger (for in-app debug panels).
 */
export function useInspect<S extends TriggerSchema>(trigger: Trigger<S>) {
  return trigger.inspect();
}

/**
 * Subscribe to the active runtime's inspector buffer and return the most
 * recent `limit` snapshots (newest first). Re-renders whenever a new run is
 * recorded.
 *
 * Use this for in-app devtools panels, custom run lists, or any "show me the
 * last N runs" UI. Combine with `<TriggerSnapshotView>` from
 * `@triggery/devtools-panel` for a turnkey UI.
 *
 * @example
 * ```tsx
 * function DebugPanel() {
 *   const history = useInspectHistory(50);
 *   return <ul>{history.map((s) => <li key={s.runId}>{s.triggerId}: {s.status}</li>)}</ul>;
 * }
 * ```
 */
export function useInspectHistory(limit = 20): readonly TriggerInspectSnapshot[] {
  const runtime = useRuntime();
  const [history, setHistory] = useState<readonly TriggerInspectSnapshot[]>(() =>
    runtime.getInspectorBuffer().slice(0, limit),
  );

  useEffect(() => {
    // Re-seed on mount in case fires happened between the initial render and
    // the effect (the runtime may have new entries already).
    setHistory(runtime.getInspectorBuffer().slice(0, limit));
    const token = runtime.subscribe(() => {
      setHistory(runtime.getInspectorBuffer().slice(0, limit));
    });
    return () => token.unregister();
  }, [runtime, limit]);

  return history;
}
