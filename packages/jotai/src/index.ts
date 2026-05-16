import type { ConditionKey, ConditionMap, Trigger, TriggerSchema } from '@triggery/core';
import { useCondition } from '@triggery/react';

/**
 * Minimal Jotai atom shape we depend on. Matches the structurally typed atom
 * returned by `atom()` from `jotai/vanilla`.
 */
export interface JotaiAtomLike<V> {
  read: unknown;
  toString(): string;
  debugLabel?: string;
  init?: V;
}

/**
 * Minimal Jotai store shape (`createStore()` from `jotai/vanilla`).
 */
export interface JotaiStoreLike {
  get<V>(atom: JotaiAtomLike<V>): V;
}

/**
 * Wire a Jotai atom into a Triggery condition.
 *
 * The runtime is pull-only — `store.get(atom)` runs **only** when a trigger
 * fires, not when the atom updates. The hook does not subscribe the component
 * to the atom; if a separate component needs the same value in JSX, use
 * `useAtomValue` from `jotai` alongside.
 *
 * @example
 * ```tsx
 * import { atom, createStore } from 'jotai';
 * import { useJotaiCondition } from '@triggery/jotai';
 *
 * const settingsAtom = atom({ sound: true, notifications: true });
 * const store = createStore();
 *
 * function SettingsBridge() {
 *   useJotaiCondition(messageTrigger, 'settings', store, settingsAtom);
 *   return null;
 * }
 * ```
 *
 * @param selector  Optional projection of the atom's value into the condition
 *                  shape. Defaults to identity, requiring the atom value type
 *                  to match `ConditionMap<S>[K]`.
 */
export function useJotaiCondition<V, S extends TriggerSchema, K extends ConditionKey<S>>(
  trigger: Trigger<S>,
  name: K,
  store: JotaiStoreLike,
  atom: JotaiAtomLike<V>,
  selector?: (value: V) => ConditionMap<S>[K],
): void {
  useCondition(
    trigger,
    name,
    () => {
      const value = store.get(atom);
      return selector ? selector(value) : (value as unknown as ConditionMap<S>[K]);
    },
    [store, atom, selector],
  );
}
