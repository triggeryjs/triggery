import type { EventKey, EventMap, Trigger, TriggerSchema } from '@triggery/core';
import { useEvent } from '@triggery/react';
import { useEffect } from 'react';

/** Minimal `WebSocket`-like interface (covers DOM `WebSocket` + most polyfills). */
export interface WebSocketLike {
  addEventListener(type: string, listener: (event: Event) => void): void;
  removeEventListener(type: string, listener: (event: Event) => void): void;
}

export interface UseWebSocketEventOptions {
  /**
   * Project the WebSocket event into the trigger event payload. Defaults to
   * passing the raw event through — override (e.g. `JSON.parse((e as MessageEvent).data)`)
   * when the trigger expects a parsed value.
   */
  readonly mapPayload?: (event: Event) => unknown;
}

/**
 * Forward a native `WebSocket` event into a Triggery event. Uses
 * `addEventListener` / `removeEventListener`, so it works on `'message'`,
 * `'open'`, `'close'`, `'error'` — anything the WebSocket emits.
 *
 * @example
 * ```ts
 * import { useWebSocketEvent } from '@triggery/socket';
 *
 * const ws = new WebSocket('wss://example.com');
 *
 * function MessageBridge() {
 *   useWebSocketEvent(chatTrigger, 'new-message', ws, 'message', {
 *     mapPayload: (e) => JSON.parse((e as MessageEvent).data),
 *   });
 *   return null;
 * }
 * ```
 */
export function useWebSocketEvent<S extends TriggerSchema, K extends EventKey<S>>(
  trigger: Trigger<S>,
  eventName: K,
  ws: WebSocketLike | null | undefined,
  wsEvent: 'message' | 'open' | 'close' | 'error' | (string & {}),
  options: UseWebSocketEventOptions = {},
): void {
  const fire = useEvent(trigger, eventName);
  const { mapPayload } = options;

  useEffect(() => {
    if (!ws) return;
    const listener = (event: Event) => {
      const payload = mapPayload ? mapPayload(event) : event;
      (fire as (payload: unknown) => void)(payload as EventMap<S>[K]);
    };
    ws.addEventListener(wsEvent, listener);
    return () => ws.removeEventListener(wsEvent, listener);
  }, [ws, wsEvent, fire, mapPayload]);
}
