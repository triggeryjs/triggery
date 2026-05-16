import { signal } from '@preact/signals-core';
import { createTrigger } from '@triggery/core';
import { useAction, useEvent } from '@triggery/react';
import { useSignalCondition } from '@triggery/signals';
import { useState } from 'react';

const friendly = signal(true);

const greetTrigger = createTrigger<{
  events: { greet: string };
  conditions: { friendly: boolean };
  actions: { say: string };
}>({
  id: 'signals-greet',
  events: ['greet'],
  required: ['friendly'],
  handler({ event, conditions, actions }) {
    if (!conditions.friendly) return;
    actions.say?.(`Hello at ${event.payload} — Signals!`);
  },
});

export function SignalsSection() {
  return (
    <section>
      <h2>Signals adapter</h2>
      <p>
        <code>useSignalCondition</code> reads via <code>.peek()</code> at fire time. Works with{' '}
        <code>@preact/signals-core</code>, alien-signals, or any peek/value-shaped signal.
      </p>
      <SettingsToggle />
      <GreetButton />
      <GreetingDisplay />
    </section>
  );
}

function SettingsToggle() {
  const [local, setLocal] = useState(friendly.peek());
  useSignalCondition(greetTrigger, 'friendly', friendly);
  return (
    <label style={{ display: 'block', margin: '12px 0' }}>
      <input
        type="checkbox"
        checked={local}
        onChange={(e) => {
          friendly.value = e.target.checked;
          setLocal(e.target.checked);
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
