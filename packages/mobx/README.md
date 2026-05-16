# @triggery/mobx

Read [MobX](https://mobx.js.org) observable state from a Triggery condition without engaging MobX dependency tracking on the host component.

## Install

```bash
pnpm add @triggery/core @triggery/react @triggery/mobx mobx
```

## Usage

```tsx
import { makeAutoObservable } from 'mobx';
import { createTrigger } from '@triggery/core';
import { useMobxCondition } from '@triggery/mobx';

class SettingsStore {
  sound = true;
  notifications = true;
  constructor() {
    makeAutoObservable(this);
  }
}

const settings = new SettingsStore();

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
  useMobxCondition(messageTrigger, 'settings', () => ({
    sound: settings.sound,
    notifications: settings.notifications,
  }));
  return null;
}
```

## How it works

The `read` function runs **only** when a trigger fires. MobX dependency tracking (`autorun`, `reaction`, `observer`) is not engaged from the hook, so:

* No component re-renders from this hook.
* No subscriber stays alive between fires.

If components also need to render the observable, wrap them in `observer` (or use `useObserver` from `mobx-react-lite`) — the two paths are orthogonal.

## API

```ts
useMobxCondition<S, K>(
  trigger: Trigger<S>,
  name: K,
  read: () => ConditionMap<S>[K],
): void
```

`read` is a plain function. Use `.get()` on boxes, dot-access on `observable.object`, etc. — exactly as you'd read MobX state anywhere else.

## License

MIT
