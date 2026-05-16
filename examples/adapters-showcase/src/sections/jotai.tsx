import { createTrigger } from '@triggery/core';
import { useJotaiCondition } from '@triggery/jotai';
import { useAction, useEvent } from '@triggery/react';
import { atom, useAtom, useStore } from 'jotai';
import { useState } from 'react';

const friendlyAtom = atom(true);

const greetTrigger = createTrigger<{
  events: { greet: string };
  conditions: { friendly: boolean };
  actions: { say: string };
}>({
  id: 'jotai-greet',
  events: ['greet'],
  required: ['friendly'],
  handler({ event, conditions, actions }) {
    if (!conditions.friendly) return;
    actions.say?.(`Hello at ${event.payload} — Jotai!`);
  },
});

export function JotaiSection() {
  return (
    <section>
      <h2>Jotai adapter</h2>
      <p>
        <code>useJotaiCondition</code> reads the atom value via the store's <code>get()</code> at
        fire time. No subscription on the host.
      </p>
      <SettingsToggle />
      <GreetButton />
      <GreetingDisplay />
    </section>
  );
}

function SettingsToggle() {
  const store = useStore();
  const [friendly, setFriendly] = useAtom(friendlyAtom);
  useJotaiCondition(greetTrigger, 'friendly', store, friendlyAtom);
  return (
    <label style={{ display: 'block', margin: '12px 0' }}>
      <input type="checkbox" checked={friendly} onChange={(e) => setFriendly(e.target.checked)} />{' '}
      Be friendly
    </label>
  );
}

function GreetButton() {
  const fire = useEvent(greetTrigger, 'greet');
  return (
    <button type="button" onClick={() => fire(new Date().toLocaleTimeString())}>
      Greet
    </button>
  );
}

function GreetingDisplay() {
  const [last, setLast] = useState<string | null>(null);
  useAction(greetTrigger, 'say', (text) => setLast(text));
  return last ? <p style={paragraph}>{last}</p> : null;
}

const paragraph = { marginTop: 12, padding: 10, background: '#eef', borderRadius: 6 } as const;
