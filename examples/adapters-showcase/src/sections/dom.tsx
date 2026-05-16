import { createTrigger } from '@triggery/core';
import { useDomEvent } from '@triggery/dom';
import { useAction } from '@triggery/react';
import { useRef, useState } from 'react';

const tapTrigger = createTrigger<{
  events: { 'window-click': MouseEvent };
  actions: { record: { x: number; y: number } };
}>({
  id: 'dom-tap',
  events: ['window-click'],
  handler({ event, actions }) {
    const e = event.payload;
    actions.record?.({ x: e.clientX, y: e.clientY });
  },
});

export function DomSection() {
  const ref = useRef<Window>(window);
  useDomEvent(tapTrigger, 'window-click', ref, 'click', { mapPayload: (e) => e });
  return (
    <section>
      <h2>DOM events adapter</h2>
      <p>
        <code>useDomEvent</code> turns native listeners (<code>click</code>, <code>resize</code>, …)
        into trigger events. The example below records every click on the window.
      </p>
      <ClickLog />
    </section>
  );
}

function ClickLog() {
  const [points, setPoints] = useState<Array<{ x: number; y: number }>>([]);
  useAction(tapTrigger, 'record', (p) => setPoints((prev) => [p, ...prev].slice(0, 5)));
  return (
    <ul style={{ padding: 0, listStyle: 'none' }}>
      {points.map((p) => (
        <li
          key={`${p.x}-${p.y}-${points.indexOf(p)}`}
          style={{ padding: 8, marginBottom: 4, background: '#eef', borderRadius: 6 }}
        >
          click at ({p.x}, {p.y})
        </li>
      ))}
      {points.length === 0 && <li style={{ color: '#999' }}>click anywhere on the page…</li>}
    </ul>
  );
}
