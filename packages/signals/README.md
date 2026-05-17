# @triggery/signals

Read a signal from a Triggery condition without engaging signal-tracking on the host component. Compatible with:

* [`@preact/signals-core`](https://github.com/preactjs/signals)
* [`alien-signals`](https://github.com/stackblitz/alien-signals)
* Any structurally-similar signal exposing `peek()` or `.value`

## Install

```bash
pnpm add @triggery/core @triggery/react @triggery/signals
# + the signal library of your choice, e.g.
pnpm add @preact/signals-core
```

## Usage

```tsx
import { signal } from '@preact/signals-core';
import { createTrigger } from '@triggery/core';
import { useSignalCondition } from '@triggery/signals';

const settings = signal({ sound: true, notifications: true });

const messageTrigger = createTrigger<{
  events: { 'new-message': { text: string } };
  conditions: { settings: { sound: boolean; notifications: boolean } };
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
  useSignalCondition(messageTrigger, 'settings', settings);
  return null;
}
```

With a selector:

```ts
useSignalCondition(messageTrigger, 'settings', profile, (p) => p.settings);
```

## How it works

Pull-only: the signal is read **only** when a trigger fires. The adapter prefers `peek()` (no dependency tracking) and falls back to `.value` if `peek` is missing. Either way, no subscriber is registered against the signal, so the host component never re-renders on signal updates.

If a component also needs to render the signal, use `useSignal()` from `@preact/signals-react` or the equivalent in your signal library — the two paths are orthogonal.

## API

```ts
useSignalCondition<V, S, K>(
  trigger: Trigger<S>,
  name: K,
  signal: { peek?(): V; readonly value?: V },
  selector?: (value: V) => ConditionMap<S>[K],
): void
```

## Documentation

Full documentation, recipes and API reference at [https://triggeryjs.github.io/packages/signals/](https://triggeryjs.github.io/packages/signals/).

## Related packages

- [`@triggery/core`](https://www.npmjs.com/package/@triggery/core) — Required peer.
- [`@triggery/react`](https://www.npmjs.com/package/@triggery/react) — Required peer.
- [`@triggery/reatom`](https://www.npmjs.com/package/@triggery/reatom) — Alternative adapter for Reatom atoms.
- [`@triggery/jotai`](https://www.npmjs.com/package/@triggery/jotai) — Alternative adapter for Jotai atoms.

See the [full package list](https://github.com/triggeryjs/triggery#packages) in the repo README.

## License

MIT &copy; Aleksey Skhomenko
