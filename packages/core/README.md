# @triggery/core

The runtime that powers [Triggery](https://github.com/triggeryjs/triggery) — a declarative `event → conditions → actions` orchestration layer.

**Framework-agnostic.** `@triggery/core` has **zero runtime dependencies** and knows nothing about React, Solid or Vue. The framework bindings (`@triggery/react`, `@triggery/solid`, `@triggery/vue`) and the state adapters are thin layers on top of this runtime — and they can be replaced by anything you author yourself in ~50 lines.

## Install

```bash
pnpm add @triggery/core
# plus your framework binding of choice (see below)
```

## Quick start

The trigger definition is the same regardless of framework — only the wiring differs. Start by defining a scenario:

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

Then wire it to your framework — pick one.

### React

```bash
pnpm add @triggery/core @triggery/react
```

```tsx
// src/main.tsx
import { createRuntime } from '@triggery/core';
import { TriggerRuntimeProvider, useAction, useCondition, useEvent } from '@triggery/react';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { messageTrigger } from './triggers/message.trigger.ts';

const runtime = createRuntime();

function SettingsProvider() {
  const [settings] = useState({ sound: true, notifications: true });
  useCondition(messageTrigger, 'settings', () => settings, [settings]);
  return null;
}
function Chat() {
  const fire = useEvent(messageTrigger, 'new-message');
  return <button onClick={() => fire({ text: 'hi', author: 'Alice' })}>send</button>;
}
function Toast() {
  useAction(messageTrigger, 'showToast', ({ title, body }) => console.log(`[${title}] ${body}`));
  return null;
}

createRoot(document.getElementById('root')!).render(
  <TriggerRuntimeProvider runtime={runtime}>
    <SettingsProvider /><Chat /><Toast />
  </TriggerRuntimeProvider>,
);
```

Full walkthrough: [`@triggery/react` README](https://github.com/triggeryjs/triggery/blob/main/packages/react/README.md). Runnable example: [`examples/vite-react-counter`](https://github.com/triggeryjs/triggery/tree/main/examples/vite-react-counter).

### Solid

```bash
pnpm add @triggery/core @triggery/solid solid-js
```

```tsx
// src/index.tsx
import { createRuntime } from '@triggery/core';
import { TriggerRuntimeProvider, useAction, useCondition, useEvent } from '@triggery/solid';
import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { messageTrigger } from './triggers/message.trigger.ts';

const runtime = createRuntime();

const SettingsProvider = () => {
  const [settings] = createSignal({ sound: true, notifications: true });
  useCondition(messageTrigger, 'settings', () => settings());
  return null;
};
const Chat = () => {
  const fire = useEvent(messageTrigger, 'new-message');
  return <button onClick={() => fire({ text: 'hi', author: 'Alice' })}>send</button>;
};
const Toast = () => {
  useAction(messageTrigger, 'showToast', ({ title, body }) => console.log(`[${title}] ${body}`));
  return null;
};

render(
  () => (
    <TriggerRuntimeProvider runtime={runtime}>
      <SettingsProvider /><Chat /><Toast />
    </TriggerRuntimeProvider>
  ),
  document.getElementById('root')!,
);
```

Full walkthrough: [`@triggery/solid` README](https://github.com/triggeryjs/triggery/blob/main/packages/solid/README.md).

### Vue 3

```bash
pnpm add @triggery/core @triggery/vue vue
```

```ts
// src/main.ts
import { createRuntime } from '@triggery/core';
import { TriggerRuntimeProvider } from '@triggery/vue';
import { createApp, defineComponent, h, ref } from 'vue';
import { useAction, useCondition, useEvent } from '@triggery/vue';
import { messageTrigger } from './triggers/message.trigger';

const runtime = createRuntime();

const SettingsProvider = defineComponent({
  setup() {
    const settings = ref({ sound: true, notifications: true });
    useCondition(messageTrigger, 'settings', () => settings.value);
    return () => null;
  },
});
const Chat = defineComponent({
  setup() {
    const fire = useEvent(messageTrigger, 'new-message');
    return () => h('button', { onClick: () => fire({ text: 'hi', author: 'Alice' }) }, 'send');
  },
});
const Toast = defineComponent({
  setup() {
    useAction(messageTrigger, 'showToast', ({ title, body }) => console.log(`[${title}] ${body}`));
    return () => null;
  },
});

createApp({
  setup: () => () =>
    h(TriggerRuntimeProvider, { runtime }, () => [h(SettingsProvider), h(Chat), h(Toast)]),
}).mount('#app');
```

Full walkthrough (with `<script setup>` SFC style): [`@triggery/vue` README](https://github.com/triggeryjs/triggery/blob/main/packages/vue/README.md).

## What's in this package

- `createTrigger<Schema>(config)` — declare a scenario in one file (events, conditions, required gate, handler).
- `createRuntime(options)` — instantiate an isolated runtime: indexed dispatch (`Map<eventKey, RuntimeTrigger[]>`), microtask + sync schedulers, middleware chain (`onFire` / `onBeforeMatch` / `onSkip` / `onActionStart` / `onActionEnd` / `onError` / `onCascade`), cascade safety (depth limit + cycle detection), inspector ring buffer with DEV/PROD auto-detection.
- `getDefaultRuntime()` / `setDefaultRuntime()` — global singleton for apps that don't want explicit provider wiring.
- Concurrency strategies for async handlers (`take-latest` / `take-every` / `take-first` / `queue` / `exhaust` / `sync`) with `AbortSignal`.
- `actions.debounce / throttle / defer / queue` chainable action wrappers.
- Last-mount-wins ownership with DEV warn-once.

## Why "framework-agnostic"

The runtime is a plain object with a `Map`-based registry. It does not import React. It does not import a vDOM. It can be embedded in:

- a worker / service worker
- a Node.js process (CLI, server, edge)
- React Native (no DOM adapters needed for the runtime itself)
- a vanilla JS page

The same `createTrigger({...})` declaration runs unchanged across all of those. Bindings only wire `useEvent` / `useCondition` / `useAction` to the host framework's lifecycle.

## Related packages

- [`@triggery/react`](https://www.npmjs.com/package/@triggery/react) — React bindings (`useEvent` / `useCondition` / `useAction`).
- [`@triggery/solid`](https://www.npmjs.com/package/@triggery/solid) — SolidJS bindings — same hook API.
- [`@triggery/vue`](https://www.npmjs.com/package/@triggery/vue) — Vue 3 bindings — same hook API.
- [`@triggery/testing`](https://www.npmjs.com/package/@triggery/testing) — Test utilities (`createTestRuntime`, `fakeScheduler`).
- [`@triggery/vite`](https://www.npmjs.com/package/@triggery/vite) — Vite plugin for auto-discovery of `*.trigger.ts`.

See the [full package list](https://github.com/triggeryjs/triggery#packages) in the repo README.

## License

MIT &copy; Aleksey Skhomenko
