import type { ConditionKey, ConditionMap, Trigger, TriggerSchema } from '@triggery/core';
import { useCondition } from '@triggery/react';

/**
 * Wire a MobX-tracked value into a Triggery condition.
 *
 * The runtime is pull-only — the `read` getter runs **only** when a trigger
 * fires, not when the observable changes. MobX dependency tracking (`autorun`,
 * `reaction`, `observer`) is _not_ engaged from this hook, so the trigger
 * pipeline doesn't trip any auto-rerender on the host component.
 *
 * If you also need the same value in JSX, wrap that component in `observer`
 * (or use `useObserver` from `mobx-react-lite`) — the two paths are
 * orthogonal.
 *
 * @example
 * ```tsx
 * import { makeAutoObservable } from 'mobx';
 * import { useMobxCondition } from '@triggery/mobx';
 *
 * class SettingsStore {
 *   sound = true;
 *   notifications = true;
 *   constructor() { makeAutoObservable(this); }
 * }
 * const settings = new SettingsStore();
 *
 * function SettingsBridge() {
 *   useMobxCondition(messageTrigger, 'settings', () => ({
 *     sound: settings.sound,
 *     notifications: settings.notifications,
 *   }));
 *   return null;
 * }
 * ```
 *
 * @param read  Plain function that reads the observable(s). Called on every
 *              fire of the trigger. Use `.get()` on boxes, dot-access on
 *              `observable.object`, etc. — same as you'd use anywhere in MobX.
 */
export function useMobxCondition<S extends TriggerSchema, K extends ConditionKey<S>>(
  trigger: Trigger<S>,
  name: K,
  read: () => ConditionMap<S>[K],
): void {
  useCondition(trigger, name, read, [read]);
}
