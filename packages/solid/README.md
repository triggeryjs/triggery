# @triggery/solid

[SolidJS](https://www.solidjs.com) bindings for Triggery. Same `useEvent` / `useCondition` / `useAction` shape as `@triggery/react`, native to Solid's signals and lifecycle.

## Install

```bash
pnpm add @triggery/core @triggery/solid solid-js
```

## Usage

```tsx
import { createSignal, type Component } from 'solid-js';
import { createRuntime, createTrigger } from '@triggery/core';
import {
  TriggerRuntimeProvider,
  TriggerScope,
  useAction,
  useCondition,
  useEvent,
} from '@triggery/solid';

type Settings = { sound: boolean; notifications: boolean };

const messageTrigger = createTrigger<{
  events: { 'new-message': { text: string; author: string } };
  conditions: { settings: Settings };
  actions: { showToast: { title: string; body: string } };
}>({
  id: 'message-received',
  events: ['new-message'],
  required: ['settings'],
  handler({ event, conditions, actions }) {
    if (!conditions.settings.notifications) return;
    actions.showToast?.({ title: event.payload.author, body: event.payload.text });
  },
});

const runtime = createRuntime();

const SettingsProvider: Component = () => {
  const [settings] = createSignal<Settings>({ sound: true, notifications: true });
  useCondition(messageTrigger, 'settings', () => settings());
  return null;
};

const Chat: Component = () => {
  const fire = useEvent(messageTrigger, 'new-message');
  return (
    <button onClick={() => fire({ text: 'hi', author: 'Alice' })}>
      send
    </button>
  );
};

const Toast: Component = () => {
  useAction(messageTrigger, 'showToast', ({ title, body }) => {
    console.log(`[${title}] ${body}`);
  });
  return null;
};

export const App: Component = () => (
  <TriggerRuntimeProvider runtime={runtime}>
    <SettingsProvider />
    <Chat />
    <Toast />
  </TriggerRuntimeProvider>
);
```

## API

### `<TriggerRuntimeProvider runtime>`

Provide a Triggery runtime to the subtree. Required for any descendant using `useEvent` / `useCondition` / `useAction`.

### `<TriggerScope id>`

Scope subsequent condition / action registrations. Triggers declared with the matching `scope` in their config see registrations from inside; global triggers see only registrations from outside any scope.

### `useEvent(trigger, eventName)`

Returns a function that fires the event. Stable identity — call once in setup, reuse the returned function.

### `useCondition(trigger, name, getter)`

Register a getter that the runtime calls at fire time. Pull-only — Solid components don't re-render because of this hook. Read signals naturally inside the getter (`() => mySignal()`). Automatically unregisters when the enclosing scope disposes.

### `useAction(trigger, name, handler)`

Register an action handler for the trigger. Invoked whenever the trigger body calls `actions.<name>(...)`. Automatically unregisters on dispose.

## How Solid integration differs from React

Solid components only run their setup once. No `useCallback`, no dependency arrays, no ref dance — just close over what you need. Condition getters that read signals automatically see the latest value at fire time because Solid signals are pure functions.

## Related packages

- [`@triggery/core`](https://www.npmjs.com/package/@triggery/core) — Required peer — the runtime this binding wraps.
- [`@triggery/react`](https://www.npmjs.com/package/@triggery/react) — React variant with the same hook API.
- [`@triggery/vue`](https://www.npmjs.com/package/@triggery/vue) — Vue 3 variant with the same hook API.

See the [full package list](https://github.com/triggeryjs/triggery#packages) in the repo README.

## License

MIT &copy; Aleksey Skhomenko
