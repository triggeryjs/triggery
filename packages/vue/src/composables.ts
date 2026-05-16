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
import { onScopeDispose } from 'vue';
import { useRuntime, useScope } from './context.ts';

type EmitterFn<P> = [P] extends [void] ? () => void : (payload: P) => void;

/**
 * Return a function that fires a trigger event. Identity is stable for the
 * lifetime of the component setup — call once and reuse.
 *
 * @example
 * ```ts
 * import { useEvent } from '@triggery/vue';
 *
 * const fire = useEvent(chatTrigger, 'submit');
 * function onClick() { fire('hello'); }
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
 * Register a condition getter. The runtime calls `getter()` only when a
 * trigger fires — no `watch`, no `computed`, no per-render subscription.
 *
 * Read refs naturally inside the getter — `() => myRef.value`. The host
 * component is never re-rendered because of this composable; if your
 * template also needs the value, use the ref / store directly there.
 *
 * Automatically unregisters when the current effect scope disposes
 * (component unmount, or scoped via `effectScope`).
 *
 * @example
 * ```ts
 * import { ref } from 'vue';
 * import { useCondition } from '@triggery/vue';
 *
 * const user = ref<User | null>(null);
 * useCondition(messageTrigger, 'user', () => user.value);
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
  onScopeDispose(() => token.unregister());
}

/**
 * Register an action handler. Invoked whenever the trigger body calls
 * `actions.<name>(...)`. Automatically unregisters on scope dispose.
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
  const token = runtime.registerAction(
    trigger.id,
    name,
    handler as (payload: unknown) => void | Promise<void>,
    { scope },
  );
  onScopeDispose(() => token.unregister());
}
