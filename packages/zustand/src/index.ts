import type { ConditionKey, ConditionMap, Trigger, TriggerSchema } from '@triggery/core';
import { useCondition } from '@triggery/react';

/**
 * Minimal Zustand store shape we depend on. Both vanilla stores (`createStore`)
 * and the React hook stores (`create`) expose this contract, so the adapter
 * works with either one without importing Zustand itself.
 */
export interface ZustandStoreLike<T> {
  getState(): T;
}

/**
 * Wire a Zustand store into a Triggery condition.
 *
 * The runtime is pull-only — `selector(store.getState())` is called when a
 * trigger fires, not when the store changes. That means:
 *
 *   1. Nothing in the React tree re-renders because of this hook. If a
 *      component also needs to read the same slice, call Zustand's own hook
 *      (`useStore(store, selector)`) alongside.
 *   2. The trigger always sees the latest state at fire-time, with no
 *      subscription overhead and no possibility of a stale snapshot.
 *
 * @example
 * ```ts
 * import { create } from 'zustand';
 * import { useZustandCondition } from '@triggery/zustand';
 *
 * const useSettings = create(() => ({ sound: true, notifications: true }));
 *
 * function SettingsBridge() {
 *   useZustandCondition(messageTrigger, 'settings', useSettings, (s) => s);
 *   return null;
 * }
 * ```
 */
export function useZustandCondition<T, S extends TriggerSchema, K extends ConditionKey<S>>(
  trigger: Trigger<S>,
  name: K,
  store: ZustandStoreLike<T>,
  selector: (state: T) => ConditionMap<S>[K],
): void {
  useCondition(trigger, name, () => selector(store.getState()), [store, selector]);
}
