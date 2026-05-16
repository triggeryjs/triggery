import type { EventKey, EventMap, Trigger, TriggerSchema } from '@triggery/core';
import { useEvent } from '@triggery/react';
import { type RefObject, useEffect } from 'react';

export interface UseResizeObserverOptions {
  /** Observer constructor options. */
  readonly observerOptions?: ResizeObserverOptions;
  /** Project the observer entry into the trigger event payload. */
  readonly mapPayload?: (entry: ResizeObserverEntry) => unknown;
}

/**
 * Fire a Triggery event whenever the observed element resizes.
 *
 * @example
 * ```tsx
 * function PanelWatcher() {
 *   const ref = useRef<HTMLDivElement>(null);
 *   useResizeObserver(layoutTrigger, 'panel-resized', ref, {
 *     mapPayload: (e) => ({ width: e.contentRect.width, height: e.contentRect.height }),
 *   });
 *   return <div ref={ref}>…</div>;
 * }
 * ```
 */
export function useResizeObserver<S extends TriggerSchema, K extends EventKey<S>>(
  trigger: Trigger<S>,
  eventName: K,
  ref: RefObject<Element | null>,
  options: UseResizeObserverOptions = {},
): void {
  const fire = useEvent(trigger, eventName);
  const { mapPayload, observerOptions } = options;

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const payload = mapPayload ? mapPayload(entry) : entry;
        (fire as (payload: unknown) => void)(payload as EventMap<S>[K]);
      }
    });
    observer.observe(element, observerOptions);
    return () => observer.disconnect();
  }, [ref, fire, mapPayload, observerOptions]);
}
