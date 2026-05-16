import { atom } from '@reatom/core';
import { createTrigger } from '@triggery/core';
import { useAction, useEvent } from '@triggery/react';
import { useReatomCondition } from '@triggery/reatom';
import { useState } from 'react';

const $friendly = atom(true);

const greetTrigger = createTrigger<{
  events: { greet: string };
  conditions: { friendly: boolean };
  actions: { say: string };
}>({
  id: 'reatom-greet',
  events: ['greet'],
  required: ['friendly'],
  handler({ event, conditions, actions }) {
    if (!conditions.friendly) return;
    actions.say?.(`Hello at ${event.payload} — Reatom!`);
  },
});

export function ReatomSection() {
  return (
    <section>
      <h2>Reatom adapter</h2>
      <p>
        <code>useReatomCondition</code> calls the atom at fire time. Atoms in Reatom 1000+ are
        callable readables — no context plumbing in the consumer.
      </p>
      <SettingsToggle />
      <GreetButton />
      <GreetingDisplay />
    </section>
  );
}

function SettingsToggle() {
  const [friendly, setFriendly] = useState<boolean>($friendly());
  useReatomCondition(greetTrigger, 'friendly', $friendly);
  return (
    <label style={{ display: 'block', margin: '12px 0' }}>
      <input
        type="checkbox"
        checked={friendly}
        onChange={(e) => {
          const next = e.target.checked;
          $friendly.set(next);
          setFriendly(next);
        }}
      />{' '}
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
