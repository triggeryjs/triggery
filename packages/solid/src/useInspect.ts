import type { Trigger, TriggerInspectSnapshot, TriggerSchema } from '@triggery/core';
import { type Accessor, createSignal, onCleanup } from 'solid-js';
import { useRuntime } from './context.ts';

/**
 * Return an accessor that yields the latest snapshot of a trigger. Useful in
 * in-app debug panels — pair it with `<TriggerSnapshotView>` from
 * `@triggery/devtools-panel` once that integration ships for Solid.
 *
 * The accessor reads through to the runtime each call; we deliberately avoid
 * memoisation so callers see fresh inspector data on every dependency tick
 * without manual subscriptions.
 */
export function useInspect<S extends TriggerSchema>(
  trigger: Trigger<S>,
): Accessor<TriggerInspectSnapshot | undefined> {
  return () => trigger.inspect();
}

/**
 * Subscribe to the active runtime's inspector buffer and return the most
 * recent `limit` snapshots (newest first). The returned accessor re-runs
 * whenever a new run is recorded.
 *
 * @example
 * ```tsx
 * function DebugPanel() {
 *   const history = useInspectHistory(50);
 *   return (
 *     <ul>
 *       <For each={history()}>
 *         {(snap) => <li>{snap.triggerId}: {snap.status}</li>}
 *       </For>
 *     </ul>
 *   );
 * }
 * ```
 */
export function useInspectHistory(limit = 20): Accessor<readonly TriggerInspectSnapshot[]> {
  const runtime = useRuntime();
  const [history, setHistory] = createSignal<readonly TriggerInspectSnapshot[]>(
    runtime.getInspectorBuffer().slice(0, limit),
  );
  const token = runtime.subscribe(() => {
    setHistory(runtime.getInspectorBuffer().slice(0, limit));
  });
  onCleanup(() => token.unregister());
  return history;
}
