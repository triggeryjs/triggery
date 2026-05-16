import type { EventKey, EventMap, Trigger, TriggerSchema } from '@triggery/core';
import { useEvent } from '@triggery/react';
import { type RefObject, useEffect } from 'react';

export interface UseIntersectionObserverOptions extends IntersectionObserverInit {
  /** Project the observer entry into the trigger event payload. */
  readonly mapPayload?: (entry: IntersectionObserverEntry) => unknown;
}

/**
 * Fire a Triggery event whenever the observed element enters or leaves the
 * viewport (or the configured root).
 *
 * @example
 * ```tsx
 * function VirtualListRow() {
 *   const ref = useRef<HTMLLIElement>(null);
 *   useIntersectionObserver(virtualTrigger, 'row-visible', ref, {
 *     rootMargin: '200px',
 *     mapPayload: (e) => ({ visible: e.isIntersecting, ratio: e.intersectionRatio }),
 *   });
 *   return <li ref={ref}>…</li>;
 * }
 * ```
 */
export function useIntersectionObserver<S extends TriggerSchema, K extends EventKey<S>>(
  trigger: Trigger<S>,
  eventName: K,
  ref: RefObject<Element | null>,
  options: UseIntersectionObserverOptions = {},
): void {
  const fire = useEvent(trigger, eventName);
  const { mapPayload, root, rootMargin, threshold } = options;

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;

    const init: IntersectionObserverInit = {};
    if (root !== undefined) init.root = root;
    if (rootMargin !== undefined) init.rootMargin = rootMargin;
    if (threshold !== undefined) init.threshold = threshold;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const payload = mapPayload ? mapPayload(entry) : entry;
        (fire as (payload: unknown) => void)(payload as EventMap<S>[K]);
      }
    }, init);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, fire, mapPayload, root, rootMargin, threshold]);
}
