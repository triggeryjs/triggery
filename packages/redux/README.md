# @triggery/redux

Read a [Redux](https://redux.js.org) store from a Triggery condition without subscribing the component to re-renders.

## Install

```bash
pnpm add @triggery/core @triggery/react @triggery/redux redux
# (or @reduxjs/toolkit, which re-exports `createStore`)
```

## Usage

```tsx
import { configureStore } from '@reduxjs/toolkit';
import { createTrigger } from '@triggery/core';
import { useReduxCondition } from '@triggery/redux';

const store = configureStore({ reducer: rootReducer });

type State = ReturnType<typeof store.getState>;
type Settings = State['settings'];

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
  useReduxCondition(messageTrigger, 'settings', store, (s) => s.settings);
  return null;
}
```

## How it works

Triggery is pull-only: the selector runs **only** when a trigger fires, not on every dispatch. The hook does not subscribe the component to the store — so dispatches never re-render the bridge component. If a separate component needs the same slice in its JSX, use `useSelector` from `react-redux` alongside.

## API

```ts
useReduxCondition<T, S, K>(
  trigger: Trigger<S>,
  name: K,
  store: { getState(): T },
  selector: (state: T) => ConditionMap<S>[K],
): void
```

## Documentation

Full documentation, recipes and API reference at [https://triggeryjs.github.io/packages/redux/](https://triggeryjs.github.io/packages/redux/).

## Related packages

- [`@triggery/core`](https://www.npmjs.com/package/@triggery/core) — Required peer.
- [`@triggery/react`](https://www.npmjs.com/package/@triggery/react) — Required peer.
- [`@triggery/zustand`](https://www.npmjs.com/package/@triggery/zustand) — Alternative adapter for Zustand stores.
- [`@triggery/jotai`](https://www.npmjs.com/package/@triggery/jotai) — Alternative adapter for Jotai atoms.

See the [full package list](https://github.com/triggeryjs/triggery#packages) in the repo README.

## License

MIT &copy; Aleksey Skhomenko
