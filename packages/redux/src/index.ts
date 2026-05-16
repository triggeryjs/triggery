import type { ConditionKey, ConditionMap, Trigger, TriggerSchema } from '@triggery/core';
import { useCondition } from '@triggery/react';

/**
 * Minimal Redux store contract we depend on. Matches what `createStore`,
 * `configureStore` and any other Redux-compatible store expose, so we don't
 * import Redux itself.
 */
export interface ReduxStoreLike<T> {
  getState(): T;
}

/**
 * Wire a Redux store into a Triggery condition.
 *
 * The runtime is pull-only — `selector(store.getState())` runs when a trigger
 * fires, not on every dispatch. The hook does **not** subscribe the component
 * to the store; if you also need the same slice in JSX, use `useSelector`
 * from `react-redux` alongside.
 *
 * The trigger always sees the latest state at fire-time, regardless of how
 * the component tree re-rendered (or didn't).
 *
 * @example
 * ```ts
 * import { configureStore } from '@reduxjs/toolkit';
 * import { useReduxCondition } from '@triggery/redux';
 *
 * const store = configureStore({ reducer: rootReducer });
 *
 * function SettingsBridge() {
 *   useReduxCondition(messageTrigger, 'settings', store, (s) => s.settings);
 *   return null;
 * }
 * ```
 */
export function useReduxCondition<T, S extends TriggerSchema, K extends ConditionKey<S>>(
  trigger: Trigger<S>,
  name: K,
  store: ReduxStoreLike<T>,
  selector: (state: T) => ConditionMap<S>[K],
): void {
  useCondition(trigger, name, () => selector(store.getState()), [store, selector]);
}
