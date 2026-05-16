import type { ConditionKey, ConditionMap, Trigger, TriggerSchema } from '@triggery/core';
import { useCondition } from '@triggery/react';

/**
 * Structural shape that matches every signal flavour we know about: a `peek()`
 * method (preferred — never engages dependency tracking) plus a `.value`
 * accessor (used as a fallback).
 *
 *   - `@preact/signals-core` ✓ has both `peek()` and `.value`
 *   - `alien-signals`        ✓ uses `.peek()` / `.value`
 *   - any TC39-style Signal  ✓ if the `peek` method is present
 */
export interface SignalLike<V> {
  peek?(): V;
  readonly value?: V;
}

/**
 * Read a signal's value without engaging dependency tracking.
 * Prefers `peek()` when available, falls back to `.value`.
 */
function readSignal<V>(signal: SignalLike<V>): V {
  if (typeof signal.peek === 'function') return signal.peek();
  return signal.value as V;
}

/**
 * Wire a signal into a Triggery condition.
 *
 * The runtime is pull-only — the signal is read **only** when a trigger
 * fires, via `peek()` so no dependency tracking is engaged. The host
 * component is never subscribed to the signal.
 *
 * If a component also needs to render the signal, use the signal library's
 * own integration (`useSignal()`, `<Signal />`, etc.) — the two paths are
 * orthogonal.
 *
 * @example
 * ```tsx
 * import { signal } from '@preact/signals-core';
 * import { useSignalCondition } from '@triggery/signals';
 *
 * const settings = signal({ sound: true, notifications: true });
 *
 * function SettingsBridge() {
 *   useSignalCondition(messageTrigger, 'settings', settings);
 *   return null;
 * }
 * ```
 */
export function useSignalCondition<V, S extends TriggerSchema, K extends ConditionKey<S>>(
  trigger: Trigger<S>,
  name: K,
  signal: SignalLike<V>,
  selector?: (value: V) => ConditionMap<S>[K],
): void {
  useCondition(
    trigger,
    name,
    () => {
      const value = readSignal(signal);
      return selector ? selector(value) : (value as unknown as ConditionMap<S>[K]);
    },
    [signal, selector],
  );
}
