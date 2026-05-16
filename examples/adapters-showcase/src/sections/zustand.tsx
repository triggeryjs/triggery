import { createTrigger } from '@triggery/core';
import { useAction, useEvent } from '@triggery/react';
import { useZustandCondition } from '@triggery/zustand';
import { useState } from 'react';
import { create } from 'zustand';

type Settings = { friendly: boolean };

const useSettings = create<Settings>(() => ({ friendly: true }));

const greetTrigger = createTrigger<{
  events: { greet: string };
  conditions: { settings: Settings };
  actions: { say: string };
}>({
  id: 'zustand-greet',
  events: ['greet'],
  required: ['settings'],
  handler({ event, conditions, actions }) {
    if (!conditions.settings.friendly) return;
    actions.say?.(`Hello at ${event.payload} — Zustand!`);
  },
});

export function ZustandSection() {
  return (
    <section>
      <h2>Zustand adapter</h2>
      <p>
        <code>useZustandCondition</code> reads the latest store snapshot at fire time. The host
        component never re-renders because of the trigger — toggle the store, click Greet, and watch
        the gate.
      </p>
      <SettingsToggle />
      <GreetButton />
      <GreetingDisplay />
    </section>
  );
}

function SettingsToggle() {
  const friendly = useSettings((s) => s.friendly);
  useZustandCondition(greetTrigger, 'settings', useSettings);
  return (
    <label style={{ display: 'block', margin: '12px 0' }}>
      <input
        type="checkbox"
        checked={friendly}
        onChange={(e) => useSettings.setState({ friendly: e.target.checked })}
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
