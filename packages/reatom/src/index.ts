import type { ConditionKey, ConditionMap, Trigger, TriggerSchema } from '@triggery/core';
import { useCondition } from '@triggery/react';

/**
 * Minimal Reatom 1000+ readable shape. Reatom atoms and computeds are callable
 * (`atom()` reads the current value); we depend on nothing else.
 */
export type ReatomReadableLike<V> = () => V;

/**
 * Wire a Reatom atom (or computed) into a Triggery condition.
 *
 * The runtime is pull-only — the atom is read **only** when a trigger fires.
 * The hook does not subscribe to atom updates, so no reactive callback is
 * registered against the atom and no re-render of the host component is
 * triggered by atom changes.
 *
 * @example
 * ```tsx
 * import { atom } from '@reatom/core';
 * import { useReatomCondition } from '@triggery/reatom';
 *
 * const $settings = atom({ sound: true, notifications: true });
 *
 * function SettingsBridge() {
 *   useReatomCondition(messageTrigger, 'settings', $settings);
 *   return null;
 * }
 * ```
 *
 * @param selector  Optional projection of the atom's value into the condition
 *                  shape. Defaults to identity.
 */
export function useReatomCondition<V, S extends TriggerSchema, K extends ConditionKey<S>>(
  trigger: Trigger<S>,
  name: K,
  atom: ReatomReadableLike<V>,
  selector?: (value: V) => ConditionMap<S>[K],
): void {
  useCondition(
    trigger,
    name,
    () => {
      const value = atom();
      return selector ? selector(value) : (value as unknown as ConditionMap<S>[K]);
    },
    [atom, selector],
  );
}
