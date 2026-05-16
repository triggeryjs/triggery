# @triggery/reatom

Read a [Reatom](https://www.reatom.dev) atom or computed from a Triggery condition without subscribing the host component.

## Install

```bash
pnpm add @triggery/core @triggery/react @triggery/reatom @reatom/core
```

## Usage

```tsx
import { atom } from '@reatom/core';
import { createTrigger } from '@triggery/core';
import { useReatomCondition } from '@triggery/reatom';

type Settings = { sound: boolean; notifications: boolean };

const $settings = atom<Settings>({ sound: true, notifications: true });

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
  useReatomCondition(messageTrigger, 'settings', $settings);
  return null;
}
```

With a selector:

```ts
useReatomCondition(messageTrigger, 'settings', $profile, (p) => p.settings);
```

## How it works

Pull-only: the atom is called (`atom()`) **only** when a trigger fires. No subscriber is registered, so the host component never re-renders on atom updates. Use Reatom's own React bindings (`reatomComponent`, `useAtom`) in components that need to render the value.

## API

```ts
useReatomCondition<V, S, K>(
  trigger: Trigger<S>,
  name: K,
  atom: () => V,
  selector?: (value: V) => ConditionMap<S>[K],
): void
```

Works with any callable Reatom primitive — atoms, computeds, derived values.

## Related packages

- [`@triggery/core`](https://www.npmjs.com/package/@triggery/core) — Required peer.
- [`@triggery/react`](https://www.npmjs.com/package/@triggery/react) — Required peer.
- [`@triggery/jotai`](https://www.npmjs.com/package/@triggery/jotai) — Alternative adapter for atom-shaped state.
- [`@triggery/signals`](https://www.npmjs.com/package/@triggery/signals) — Alternative adapter for signal-shaped state.

See the [full package list](https://github.com/triggeryjs/triggery#packages) in the repo README.

## License

MIT &copy; Aleksey Skhomenko
