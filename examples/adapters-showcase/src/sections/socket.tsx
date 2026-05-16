import { createTrigger } from '@triggery/core';
import { useAction } from '@triggery/react';
import { useWebSocketEvent } from '@triggery/socket';
import { useEffect, useRef, useState } from 'react';

const wsTrigger = createTrigger<{
  events: { tick: { i: number; at: number } };
  actions: { display: { i: number; at: number } };
}>({
  id: 'ws-tick',
  events: ['tick'],
  handler({ event, actions }) {
    actions.display?.(event.payload);
  },
});

/**
 * Fakes a WebSocket using `setInterval` + a minimal stand-in object that
 * implements the subset of the WS surface that `useWebSocketEvent` needs
 * (`addEventListener('message', …)` and `removeEventListener`). Real apps
 * pass an actual `WebSocket` instance.
 */
function useFakeSocket(): WebSocket {
  const fake = useRef<WebSocket>();
  if (!fake.current) {
    const listeners = new Set<(ev: MessageEvent) => void>();
    fake.current = {
      addEventListener: (type: string, fn: (ev: MessageEvent) => void) => {
        if (type === 'message') listeners.add(fn);
      },
      removeEventListener: (type: string, fn: (ev: MessageEvent) => void) => {
        if (type === 'message') listeners.delete(fn);
      },
    } as unknown as WebSocket;
    let i = 0;
    setInterval(() => {
      i += 1;
      const ev = new MessageEvent('message', {
        data: JSON.stringify({ i, at: Date.now() }),
      });
      for (const fn of listeners) fn(ev);
    }, 1500);
  }
  return fake.current;
}

export function SocketSection() {
  const socket = useFakeSocket();
  useWebSocketEvent(wsTrigger, 'tick', socket, {
    mapPayload: (ev) => JSON.parse(ev.data as string) as { i: number; at: number },
  });
  return (
    <section>
      <h2>WebSocket adapter</h2>
      <p>
        <code>useWebSocketEvent</code> wires a native <code>WebSocket</code> (or any compatible
        EventTarget) into a Triggery event. The fake socket below ticks every 1.5s for the demo —
        swap it for <code>new WebSocket(url)</code> in production.
      </p>
      <TickLog />
    </section>
  );
}

function TickLog() {
  const [ticks, setTicks] = useState<Array<{ i: number; at: number }>>([]);
  useAction(wsTrigger, 'display', (t) => setTicks((prev) => [t, ...prev].slice(0, 5)));
  useEffect(() => () => setTicks([]), []);
  return (
    <ul style={{ padding: 0, listStyle: 'none' }}>
      {ticks.map((t) => (
        <li key={t.i} style={{ padding: 8, marginBottom: 4, background: '#eef', borderRadius: 6 }}>
          tick #{t.i} @ {new Date(t.at).toLocaleTimeString()}
        </li>
      ))}
      {ticks.length === 0 && <li style={{ color: '#999' }}>waiting for first tick…</li>}
    </ul>
  );
}
