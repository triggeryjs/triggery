import type { Trigger, TriggerInspectSnapshot, TriggerSchema } from '@triggery/core';
import { onScopeDispose, type Ref, ref } from 'vue';
import { useRuntime } from './context.ts';

/**
 * Returns a `Ref<TriggerInspectSnapshot | undefined>` that updates whenever
 * the trigger's inspector buffer gains a new entry. We subscribe to the
 * runtime instead of wrapping `trigger.inspect()` in a `computed`: snapshots
 * are runtime-side and have no Vue reactivity dependency to track, so a
 * `computed` would never recompute.
 */
export function useInspect<S extends TriggerSchema>(
  trigger: Trigger<S>,
): Ref<TriggerInspectSnapshot | undefined> {
  const runtime = useRuntime();
  const snap = ref<TriggerInspectSnapshot | undefined>(trigger.inspect()) as Ref<
    TriggerInspectSnapshot | undefined
  >;
  const token = runtime.subscribe(() => {
    snap.value = trigger.inspect();
  });
  onScopeDispose(() => token.unregister());
  return snap;
}

/**
 * Subscribe to the active runtime's inspector buffer and return a `Ref`
 * holding the most recent `limit` snapshots (newest first). The ref updates
 * whenever a new run is recorded; unsubscribes on scope dispose.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useInspectHistory } from '@triggery/vue';
 * const history = useInspectHistory(50);
 * </script>
 *
 * <template>
 *   <ul>
 *     <li v-for="snap in history" :key="snap.runId">
 *       {{ snap.triggerId }}: {{ snap.status }}
 *     </li>
 *   </ul>
 * </template>
 * ```
 */
export function useInspectHistory(limit = 20): Ref<readonly TriggerInspectSnapshot[]> {
  const runtime = useRuntime();
  const history = ref<readonly TriggerInspectSnapshot[]>(
    runtime.getInspectorBuffer().slice(0, limit),
  ) as Ref<readonly TriggerInspectSnapshot[]>;
  const token = runtime.subscribe(() => {
    history.value = runtime.getInspectorBuffer().slice(0, limit);
  });
  onScopeDispose(() => token.unregister());
  return history;
}
