import type { TriggerInspectSnapshot } from './types.ts';

export type InspectorImpl = {
  record(snapshot: TriggerInspectSnapshot): void;
  getBuffer(): readonly TriggerInspectSnapshot[];
  getLastForTrigger(triggerId: string): TriggerInspectSnapshot | undefined;
  subscribe(listener: (snapshot: TriggerInspectSnapshot) => void): () => void;
  clear(): void;
};

export function createInspector(bufferSize: number): InspectorImpl {
  const buffer: TriggerInspectSnapshot[] = [];
  const lastByTrigger = new Map<string, TriggerInspectSnapshot>();
  const listeners = new Set<(snapshot: TriggerInspectSnapshot) => void>();

  return {
    record(snapshot) {
      buffer.unshift(snapshot);
      if (buffer.length > bufferSize) buffer.length = bufferSize;
      lastByTrigger.set(snapshot.triggerId, snapshot);
      for (const listener of listeners) {
        try {
          listener(snapshot);
        } catch {
          // Listeners must never bring down the runtime.
        }
      }
    },
    getBuffer() {
      return buffer;
    },
    getLastForTrigger(triggerId) {
      return lastByTrigger.get(triggerId);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clear() {
      buffer.length = 0;
      lastByTrigger.clear();
    },
  };
}
