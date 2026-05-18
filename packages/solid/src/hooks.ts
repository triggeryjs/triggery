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
import { onCleanup } from 'solid-js';
import { useRuntime, useScope } from './context.ts';

type EmitterFn<P> = [P] extends [void] ? () => void : (payload: P) => void;

/**
 * Return a stable function that fires a trigger event.
 *
 * Solid components only run their setup once, so the returned emitter
 * captures the active runtime at setup-time. Don't call this conditionally —
 * call it once during setup and reuse the returned function.
 *
 * @example
 * ```tsx
 * function ChatInput() {
 *   const fire = useEvent(chatTrigger, 'submit');
 *   return <input onChange={(e) => fire(e.currentTarget.value)} />;
 * }
 * ```
 */
export function useEvent<S extends TriggerSchema, K extends EventKey<S>>(
  _trigger: Trigger<S>,
  eventName: K,
): EmitterFn<EventMap<S>[K]> {
  const runtime = useRuntime();
  return ((payload?: unknown) => {
    runtime.fire(eventName, payload);
  }) as EmitterFn<EventMap<S>[K]>;
}

/**
 * Register a condition getter for a trigger. The runtime calls `getter()` at
 * fire-time only — there are no subscriptions and no re-renders.
 *
 * In Solid the getter naturally captures any signal accessors it references —
 * just pass `() => mySignal()` (or even the signal accessor directly if its
 * shape matches the condition type).
 *
 * Automatically unregisters when the enclosing scope disposes.
 *
 * @example
 * ```tsx
 * const [user, setUser] = createSignal<User | null>(null);
 *
 * function UserProvider() {
 *   useCondition(messageTrigger, 'user', () => user());
 *   return null;
 * }
 * ```
 */
export function useCondition<S extends TriggerSchema, K extends ConditionKey<S>>(
  trigger: Trigger<S>,
  name: K,
  getter: () => ConditionMap<S>[K],
): void {
  const runtime = useRuntime();
  const scope = useScope();
  const token = runtime.registerCondition(trigger.id, name, getter, { scope });
  onCleanup(() => token.unregister());
}

/**
 * Register an action handler. Called by the runtime whenever the trigger
 * body invokes `actions.<name>(...)`.
 *
 * @example
 * ```tsx
 * function ToastSlot() {
 *   useAction(messageTrigger, 'showToast', (payload) =>
 *     toast.success(payload.title, { description: payload.body }),
 *   );
 *   return null;
 * }
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
  // v0.10: subscribeAction is additive — every component subscribed to the
  // same action runs on every emit (in addition to any handler registered
  // via runtime.registerAction).
  const token = runtime.subscribeAction(
    trigger.id,
    name,
    handler as (payload: unknown) => void | Promise<void>,
    { scope },
  );
  onCleanup(() => token.unregister());
}
