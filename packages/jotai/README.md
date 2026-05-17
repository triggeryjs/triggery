# @triggery/jotai

Read a [Jotai](https://jotai.org) atom from a Triggery condition without subscribing the host component to atom updates.

## Install

```bash
pnpm add @triggery/core @triggery/react @triggery/jotai jotai
```

## Usage

```tsx
import { atom, createStore } from 'jotai';
import { createTrigger } from '@triggery/core';
import { useJotaiCondition } from '@triggery/jotai';

type Settings = { sound: boolean; notifications: boolean };

const settingsAtom = atom<Settings>({ sound: true, notifications: true });
const store = createStore();

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
  useJotaiCondition(messageTrigger, 'settings', store, settingsAtom);
  return null;
}
```

With a selector for projection:

```ts
useJotaiCondition(messageTrigger, 'settings', store, profileAtom, (p) => p.settings);
```

## How it works

Pull-only: `store.get(atom)` runs **only** when a trigger fires, not on every atom update. The host component is never re-rendered by atom changes — that's `useAtomValue`'s job and lives in the components that actually render the value.

## API

```ts
useJotaiCondition<V, S, K>(
  trigger: Trigger<S>,
  name: K,
  store: { get<V>(atom): V },
  atom: Atom<V>,
  selector?: (value: V) => ConditionMap<S>[K],
): void
```

## Documentation

Full documentation, recipes and API reference at [https://triggeryjs.github.io/packages/jotai/](https://triggeryjs.github.io/packages/jotai/).

## Related packages

- [`@triggery/core`](https://www.npmjs.com/package/@triggery/core) — Required peer.
- [`@triggery/react`](https://www.npmjs.com/package/@triggery/react) — Required peer.
- [`@triggery/zustand`](https://www.npmjs.com/package/@triggery/zustand) — Alternative adapter for Zustand stores.
- [`@triggery/redux`](https://www.npmjs.com/package/@triggery/redux) — Alternative adapter for Redux stores.

See the [full package list](https://github.com/triggeryjs/triggery#packages) in the repo README.

## License

MIT &copy; Aleksey Skhomenko
