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
 *
 * For triggers that declare their conditions inline via `conditions:` config
 * (v0.10+), {@link useSetCondition} is usually preferable: it pushes the value
 * through the trigger's typed setter and pairs cleanly with React state.
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
 * Push a value into a condition declared inline via `createTrigger({ conditions: { ... } })`
 * (v0.10+). The hook calls `trigger.setCondition(name, value)` on every change
 * and again on mount. Use it when the value lives in a React state / prop and
 * the trigger declared the condition with an explicit initial value.
 *
 * @example
 * ```tsx
 * const [user, setUser] = useState<User | null>(null);
 * useSetCondition(messageTrigger, 'user', user);
 * ```
 */
export function useSetCondition<S extends TriggerSchema, K extends ConditionKey<S>>(
  trigger: Trigger<S>,
  name: K,
  value: ConditionMap<S>[K] | null,
): void {
  useEffect(() => {
    trigger.setCondition(name, value);
  }, [trigger, name, value]);
}

/**
 * Subscribe to a trigger's action channel. The handler runs every time the
 * trigger body calls `actions.<name>(...)`. Multiple components can subscribe
 * to the same action — every subscriber is invoked on each emit.
 *
 * **v0.10 semantics change**: in v0.9 multiple `useAction` calls for the same
 * `(trigger, name)` followed last-mount-wins (only the most-recently-mounted
 * handler ran). Starting in v0.10 every subscriber is invoked — the more
 * useful default. If you want exclusive-handler behaviour, use
 * `runtime.registerAction(trigger.id, name, fn)` directly.
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
    // Subscribe via the additive `subscribeAction` runtime path so multiple
    // components can react to the same action. Scope is honoured: a scoped
    // trigger only receives subscriptions from the matching scope (or a
    // global trigger from a global scope) — mismatches are no-ops with a
    // DEV warn-once.
    const token = runtime.subscribeAction(
      trigger.id,
      name as string,
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
