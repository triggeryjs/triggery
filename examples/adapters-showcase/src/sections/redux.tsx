import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { createTrigger } from '@triggery/core';
import { useAction, useEvent } from '@triggery/react';
import { useReduxCondition } from '@triggery/redux';
import { useState } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';

type RootState = { settings: { friendly: boolean } };

const slice = createSlice({
  name: 'settings',
  initialState: { friendly: true } as { friendly: boolean },
  reducers: {
    setFriendly(state, action: PayloadAction<boolean>) {
      state.friendly = action.payload;
    },
  },
});

const store = configureStore({ reducer: { settings: slice.reducer } });
type AppDispatch = typeof store.dispatch;

const greetTrigger = createTrigger<{
  events: { greet: string };
  conditions: { friendly: boolean };
  actions: { say: string };
}>({
  id: 'redux-greet',
  events: ['greet'],
  required: ['friendly'],
  handler({ event, conditions, actions }) {
    if (!conditions.friendly) return;
    actions.say?.(`Hello at ${event.payload} — Redux!`);
  },
});

export function ReduxSection() {
  return (
    <Provider store={store}>
      <section>
        <h2>Redux adapter</h2>
        <p>
          <code>useReduxCondition</code> reads via the store's <code>getState()</code> at fire time
          — no <code>useSelector</code> needed for the gate.
        </p>
        <SettingsToggle />
        <GreetButton />
        <GreetingDisplay />
      </section>
    </Provider>
  );
}

function SettingsToggle() {
  const friendly = useSelector((s: RootState) => s.settings.friendly);
  const dispatch = useDispatch<AppDispatch>();
  useReduxCondition(greetTrigger, 'friendly', store, (s: RootState) => s.settings.friendly);
  return (
    <label style={{ display: 'block', margin: '12px 0' }}>
      <input
        type="checkbox"
        checked={friendly}
        onChange={(e) => dispatch(slice.actions.setFriendly(e.target.checked))}
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
