import type { TriggerInspectSnapshot } from './types.ts';

export type InspectorImpl = {
  record(snapshot: TriggerInspectSnapshot): void;
  getBuffer(): readonly TriggerInspectSnapshot[];
  getLastForTrigger(triggerId: string): TriggerInspectSnapshot | undefined;
  subscribe(listener: (snapshot: TriggerInspectSnapshot) => void): () => void;
  clear(): void;
};

/**
 * Ring-buffer inspector. `record` is O(1) — writes into a fixed-size slot array
 * with a wrap-around index, no `unshift`/`shift` allocations. `getBuffer`
 * materializes a newest-first array on demand (rare relative to fires).
 */
export function createInspector(bufferSize: number): InspectorImpl {
  const size = Math.max(1, bufferSize);
  const slots: (TriggerInspectSnapshot | undefined)[] = new Array(size);
  let head = 0;
  let count = 0;
  const lastByTrigger = new Map<string, TriggerInspectSnapshot>();
  const listeners = new Set<(snapshot: TriggerInspectSnapshot) => void>();

  return {
    record(snapshot) {
      slots[head] = snapshot;
      head = head + 1 === size ? 0 : head + 1;
      if (count < size) count++;
      lastByTrigger.set(snapshot.triggerId, snapshot);
      if (listeners.size > 0) {
        for (const listener of listeners) {
          try {
            listener(snapshot);
          } catch {
            // Listeners must never bring down the runtime.
          }
        }
      }
    },
    getBuffer() {
      if (count === 0) return [];
      const out: TriggerInspectSnapshot[] = new Array(count);
      let idx = head === 0 ? size - 1 : head - 1;
      for (let i = 0; i < count; i++) {
        out[i] = slots[idx] as TriggerInspectSnapshot;
        idx = idx === 0 ? size - 1 : idx - 1;
      }
      return out;
    },
    getLastForTrigger(triggerId) {
      return lastByTrigger.get(triggerId);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clear() {
      for (let i = 0; i < size; i++) slots[i] = undefined;
      head = 0;
      count = 0;
      lastByTrigger.clear();
    },
  };
}
