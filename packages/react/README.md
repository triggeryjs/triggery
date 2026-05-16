# @triggery/react

React 18+/19 bindings for [Triggery](https://github.com/triggeryjs/triggery). Same `useEvent` / `useCondition` / `useAction` shape as `@triggery/solid` and `@triggery/vue`. **Zero runtime dependencies** — the binding is a thin lifecycle layer over `@triggery/core`.

## Install

```bash
pnpm add @triggery/core @triggery/react
# pnpm / npm / yarn / bun all work
```

`react` and `react-dom` are peer deps (≥ 18.0.0).

## Quick start

A complete scenario lives across four small files. The trigger reads like a spec, components only know about their own port.

### 1. Define the trigger

```ts
// src/triggers/message.trigger.ts
import { createTrigger } from '@triggery/core';

type Settings = { sound: boolean; notifications: boolean };

export const messageTrigger = createTrigger<{
  events: { 'new-message': { text: string; author: string } };
  conditions: { settings: Settings };
  actions: { showToast: { title: string; body: string } };
}>({
  id: 'message-received',
  events: ['new-message'],
  required: ['settings'],
  handler({ event, conditions, actions }) {
    if (!conditions.settings.notifications) return;
    actions.showToast?.({
      title: event.payload.author,
      body: event.payload.text,
    });
  },
});
```

### 2. Wrap the tree

```tsx
// src/main.tsx
import { createRuntime } from '@triggery/core';
import { TriggerRuntimeProvider } from '@triggery/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';

const runtime = createRuntime();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TriggerRuntimeProvider runtime={runtime}>
      <App />
    </TriggerRuntimeProvider>
  </StrictMode>,
);
```

### 3. Wire components into ports

```tsx
// src/App.tsx
import { useAction, useCondition, useEvent } from '@triggery/react';
import { useState } from 'react';
import { messageTrigger } from './triggers/message.trigger.ts';

function SettingsProvider() {
  const [settings] = useState({ sound: true, notifications: true });
  useCondition(messageTrigger, 'settings', () => settings, [settings]);
  return null;
}

function Chat() {
  const fire = useEvent(messageTrigger, 'new-message');
  return (
    <button type="button" onClick={() => fire({ text: 'hi', author: 'Alice' })}>
      send
    </button>
  );
}

function Toast() {
  useAction(messageTrigger, 'showToast', ({ title, body }) => {
    console.log(`[${title}] ${body}`);
  });
  return null;
}

export function App() {
  return (
    <>
      <SettingsProvider />
      <Chat />
      <Toast />
    </>
  );
}
```

Click the button — `Toast` gets the action. Toggle `settings.notifications` to false — silent.

For a runnable version: [`examples/vite-react-counter`](https://github.com/triggeryjs/triggery/tree/main/examples/vite-react-counter) or open it in StackBlitz from the [main README](https://github.com/triggeryjs/triggery#try-it-in-5-seconds).

## API

### `<TriggerRuntimeProvider runtime>`

Provides a `Runtime` to the subtree. Required for any descendant using the hooks below. You normally create one runtime per app, but isolated runtimes (per-feature, per-tab, per-test) are fully supported.

### `<TriggerScope id>`

Scopes condition / action registrations to triggers that declared the same `scope` id. Triggers without a scope see only registrations made outside any `<TriggerScope>`.

### `useEvent(trigger, eventName)`

Returns a stable `(payload) => void` emitter. Identity is stable across renders.

### `useCondition(trigger, name, getter, deps?)`

Registers a getter the runtime invokes **at fire time**. Pull-only — your component never re-renders because of the trigger. `deps` work like `useMemo` — when they change the runtime sees the fresh closure.

### `useAction(trigger, name, handler)`

Registers an action handler. Last-mount-wins with a DEV warn-once on collision.

### `useInlineTrigger({ on, do, id? })`

Defines a one-off trigger inline inside a component — useful for tiny analytics taps or modal-stack coordination that doesn't need its own `*.trigger.ts` file. The trigger lives for the lifetime of the component.

### `useInspect(trigger)` / `useInspectHistory(limit?)`

Read the latest snapshot of a trigger, or subscribe to the runtime's inspector ring buffer. Pair with `<InspectorView>` from `@triggery/devtools-panel` for a turnkey debug UI.

### `createNamedHooks(trigger)`

Returns `{ useFooEvent, useBarCondition, useBazAction }` named hooks derived from the trigger schema — purely for code readability in larger files.

## Related packages

- [`@triggery/core`](https://www.npmjs.com/package/@triggery/core) — Required peer — the runtime this binding wraps.
- [`@triggery/solid`](https://www.npmjs.com/package/@triggery/solid) — SolidJS variant with the same hook API.
- [`@triggery/vue`](https://www.npmjs.com/package/@triggery/vue) — Vue 3 variant with the same hook API.
- [`@triggery/zustand`](https://www.npmjs.com/package/@triggery/zustand) — Adapter: read a Zustand store from a condition.
- [`@triggery/redux`](https://www.npmjs.com/package/@triggery/redux) — Adapter: read a Redux store from a condition.
- [`@triggery/jotai`](https://www.npmjs.com/package/@triggery/jotai) — Adapter: read a Jotai atom from a condition.
- [`@triggery/query`](https://www.npmjs.com/package/@triggery/query) — Adapter: read a TanStack Query cache entry.

See the [full package list](https://github.com/triggeryjs/triggery#packages) in the repo README.

## License

MIT &copy; Aleksey Skhomenko
