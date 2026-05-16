import { createTrigger } from '@triggery/core';
import { useMobxCondition } from '@triggery/mobx';
import { useAction, useEvent } from '@triggery/react';
import { configure, makeAutoObservable } from 'mobx';
import { useState } from 'react';

configure({ enforceActions: 'never' });

class SettingsStore {
  friendly = true;
  constructor() {
    makeAutoObservable(this);
  }
  setFriendly(v: boolean) {
    this.friendly = v;
  }
}
const settings = new SettingsStore();

const greetTrigger = createTrigger<{
  events: { greet: string };
  conditions: { friendly: boolean };
  actions: { say: string };
}>({
  id: 'mobx-greet',
  events: ['greet'],
  required: ['friendly'],
  handler({ event, conditions, actions }) {
    if (!conditions.friendly) return;
    actions.say?.(`Hello at ${event.payload} — MobX!`);
  },
});

export function MobxSection() {
  return (
    <section>
      <h2>MobX adapter</h2>
      <p>
        <code>useMobxCondition</code> reads the observable inside a non-tracking getter — the host
        component is never invalidated by the trigger.
      </p>
      <SettingsToggle />
      <GreetButton />
      <GreetingDisplay />
    </section>
  );
}

function SettingsToggle() {
  const [friendly, setLocal] = useState(settings.friendly);
  useMobxCondition(greetTrigger, 'friendly', () => settings.friendly);
  return (
    <label style={{ display: 'block', margin: '12px 0' }}>
      <input
        type="checkbox"
        checked={friendly}
        onChange={(e) => {
          settings.setFriendly(e.target.checked);
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
