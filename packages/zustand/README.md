# @triggery/zustand

Read a [Zustand](https://github.com/pmndrs/zustand) store from a Triggery condition.

## Install

```bash
pnpm add @triggery/core @triggery/react @triggery/zustand zustand
```

## Usage

```tsx
import { create } from 'zustand';
import { createTrigger } from '@triggery/core';
import { useEvent, useAction } from '@triggery/react';
import { useZustandCondition } from '@triggery/zustand';

type Settings = { sound: boolean; notifications: boolean };

const useSettings = create<Settings>(() => ({ sound: true, notifications: true }));

const messageTrigger = createTrigger<{
  events: { 'new-message': { text: string } };
  conditions: { settings: Settings };
  actions: { showToast: { body: string } };
}>({
  id: 'message-received',
  events: ['new-message'],
  required: ['settings'],
  handler({ event, conditions, actions }) {
    if (!conditions.settings.notifications) return;
    actions.showToast?.({ body: event.payload.text });
  },
});

function SettingsBridge() {
  useZustandCondition(messageTrigger, 'settings', useSettings, (s) => s);
  return null;
}
```

## How it works

The runtime is pull-only: `selector(store.getState())` is called **only** when a trigger fires, not when the store changes. That means:

1. Nothing in your React tree re-renders because of this hook. If a component also needs the same slice, call Zustand's own `useStore(store, selector)` alongside.
2. The trigger always sees the latest state at fire-time — no subscription, no possibility of a stale snapshot.

## API

```ts
useZustandCondition<T, S, K>(
  trigger: Trigger<S>,
  name: K,
  store: { getState(): T },
  selector: (state: T) => ConditionMap<S>[K],
): void
```

Works with both vanilla stores (`createStore`) and hook stores (`create`).

## License

MIT
