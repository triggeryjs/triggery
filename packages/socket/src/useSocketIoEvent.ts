import type { EventKey, EventMap, Trigger, TriggerSchema } from '@triggery/core';
import { useEvent } from '@triggery/react';
import { useEffect } from 'react';

/**
 * Minimal socket.io client shape we depend on. Matches both v3+ `Socket` and
 * `Manager` instances without importing socket.io.
 */
export interface SocketIoLike {
  on(eventName: string, listener: (...args: unknown[]) => void): void;
  off(eventName: string, listener: (...args: unknown[]) => void): void;
}

export interface UseSocketIoEventOptions {
  /**
   * Map socket.io event args to the trigger event payload. socket.io listeners
   * receive `...args` (variadic), so this defaults to passing the FIRST arg
   * through. Override when you need the rest or a different shape.
   */
  readonly mapPayload?: (...args: unknown[]) => unknown;
}

/**
 * Forward a socket.io event into a Triggery event.
 *
 * The listener is attached on mount via `socket.on(eventName, …)` and removed
 * on unmount or when `socket` / `socketEvent` change.
 *
 * @example
 * ```tsx
 * import { io } from 'socket.io-client';
 * import { useSocketIoEvent } from '@triggery/socket';
 *
 * const socket = io('https://example.com');
 *
 * function MessageBridge() {
 *   useSocketIoEvent(chatTrigger, 'new-message', socket, 'message');
 *   return null;
 * }
 * ```
 */
export function useSocketIoEvent<S extends TriggerSchema, K extends EventKey<S>>(
  trigger: Trigger<S>,
  eventName: K,
  socket: SocketIoLike | null | undefined,
  socketEvent: string,
  options: UseSocketIoEventOptions = {},
): void {
  const fire = useEvent(trigger, eventName);
  const { mapPayload } = options;

  useEffect(() => {
    if (!socket) return;
    const listener = (...args: unknown[]) => {
      const payload = mapPayload ? mapPayload(...args) : args[0];
      (fire as (payload: unknown) => void)(payload as EventMap<S>[K]);
    };
    socket.on(socketEvent, listener);
    return () => socket.off(socketEvent, listener);
  }, [socket, socketEvent, fire, mapPayload]);
}
