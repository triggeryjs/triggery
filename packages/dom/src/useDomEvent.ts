import type { EventKey, EventMap, Trigger, TriggerSchema } from '@triggery/core';
import { useEvent } from '@triggery/react';
import { type RefObject, useEffect } from 'react';

/**
 * Resolve the DOM target — supports an explicit `EventTarget`, a React ref,
 * or `null`/`undefined` (means "don't attach yet"). A ref pointing at `null`
 * also defers attachment until the ref is populated.
 */
function resolveTarget(target: DomEventTarget | null | undefined): EventTarget | null {
  if (target == null) return null;
  if (typeof (target as RefObject<EventTarget | null>).current !== 'undefined') {
    return (target as RefObject<EventTarget | null>).current ?? null;
  }
  return target as EventTarget;
}

export type DomEventTarget = EventTarget | RefObject<EventTarget | null>;

export interface UseDomEventOptions {
  /** Standard `addEventListener` options — `capture`, `passive`, `once`, `signal`. */
  readonly listenerOptions?: AddEventListenerOptions;
  /**
   * Map the raw DOM event into the trigger event payload.
   * Defaults to passing the event object through.
   */
  readonly mapPayload?: (event: Event) => unknown;
}

/**
 * Forward a DOM event into a Triggery event. The listener is attached on
 * mount and removed on unmount; if the target is a ref that's not yet
 * populated, the listener is deferred until the ref resolves.
 *
 * @example
 * ```tsx
 * function ChatInput() {
 *   const ref = useRef<HTMLInputElement>(null);
 *   useDomEvent(chatTrigger, 'submit', ref, 'keydown', {
 *     mapPayload: (e) => ({ key: (e as KeyboardEvent).key }),
 *   });
 *   return <input ref={ref} />;
 * }
 *
 * function GlobalScrollWatcher() {
 *   useDomEvent(scrollTrigger, 'scroll', window, 'scroll', { listenerOptions: { passive: true } });
 *   return null;
 * }
 * ```
 */
export function useDomEvent<S extends TriggerSchema, K extends EventKey<S>>(
  trigger: Trigger<S>,
  eventName: K,
  target: DomEventTarget | null | undefined,
  domEventName: string,
  options: UseDomEventOptions = {},
): void {
  const fire = useEvent(trigger, eventName);
  const { mapPayload, listenerOptions } = options;

  useEffect(() => {
    const resolved = resolveTarget(target);
    if (!resolved) return;

    const listener = (event: Event) => {
      const payload = mapPayload ? mapPayload(event) : event;
      (fire as (payload: unknown) => void)(payload as EventMap<S>[K]);
    };

    resolved.addEventListener(domEventName, listener, listenerOptions);
    return () => {
      resolved.removeEventListener(domEventName, listener, listenerOptions);
    };
  }, [target, domEventName, fire, mapPayload, listenerOptions]);
}
