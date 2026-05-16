import type {
  ActionKey,
  ActionMap,
  ConditionKey,
  ConditionMap,
  EventKey,
  EventMap,
  Trigger,
  TriggerSchema,
} from '@triggery/core';
import { useCallback, useEffect, useRef } from 'react';
import { useRuntime } from './context.ts';

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
  // Keep the latest getter in a ref — the runtime reads through a stable wrapper.
  const getterRef = useRef(getter);
  getterRef.current = getter;
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps managed by caller
  const stableGetter = useCallback(() => getterRef.current(), deps);

  useEffect(() => {
    const token = runtime.registerCondition(trigger.id, name, stableGetter);
    return () => token.unregister();
  }, [runtime, trigger.id, name, stableGetter]);
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
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const token = runtime.registerAction(trigger.id, name, (payload) =>
      (handlerRef.current as (payload: unknown) => void | Promise<void>)(payload),
    );
    return () => token.unregister();
  }, [runtime, trigger.id, name]);
}

/**
 * Return the latest snapshot of a trigger (for in-app debug panels).
 */
export function useInspect<S extends TriggerSchema>(trigger: Trigger<S>) {
  return trigger.inspect();
}
