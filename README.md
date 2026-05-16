# Triggery

> **Write business logic, not boilerplate.**

[![CI](https://github.com/triggeryjs/triggery/actions/workflows/ci.yml/badge.svg)](https://github.com/triggeryjs/triggery/actions/workflows/ci.yml)
[![CodSpeed](https://img.shields.io/endpoint?url=https://codspeed.io/badge.json)](https://codspeed.io/triggeryjs/triggery?utm_source=badge)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

A declarative, hook-first orchestration layer for React apps: **event → conditions → actions** in one file. Not a state manager, not an FRP framework — a thin coordinator that lifts business logic out of UI components.

```ts
// triggers/message.trigger.ts
export const messageTrigger = createTrigger<{
  events: { 'new-message': { author: string; text: string; channelId: string } };
  conditions: { user: { id: string; name: string }; settings: { sound: boolean } };
  actions: { showToast: { title: string }; playSound: 'beep' | 'mod-alert' };
}>({
  id: 'message-received',
  events: ['new-message'],
  required: ['user', 'settings'],
  handler({ event, conditions, actions, check }) {
    if (!conditions.user || !conditions.settings) return;
    if (check.is('settings', (s) => s.sound)) actions.playSound?.('beep');
    actions.showToast?.({ title: `${event.payload.author}: ${event.payload.text}` });
  },
});
```

```tsx
// notifications/Toast.tsx
useAction(messageTrigger, 'showToast', (p) => toast.success(p.title));

// auth/UserProvider.tsx
useCondition(messageTrigger, 'user', () => currentUser, [currentUser]);

// chat/Chat.tsx
const fire = useEvent(messageTrigger, 'new-message');
useEffect(() => socket.on('msg', fire), [fire]);
```

## Install

> Pre-1.0: the API is unstable; minor versions may introduce breaking changes.

```bash
pnpm add @triggery/core @triggery/react
```

## Packages

| Package | Description |
|---|---|
| [`@triggery/core`](./packages/core) | Runtime: `createTrigger`, `createRuntime`, indexed dispatch, inspector, middleware |
| [`@triggery/react`](./packages/react) | React bindings: `useEvent`, `useCondition`, `useAction`, `<TriggerRuntimeProvider>` |
| [`@triggery/testing`](./packages/testing) | Testing utilities (V1.1) |

## Why

Business logic of the form _"when X happens, do Y if Z is true"_ is currently spread across `useEffect`, sagas, observable middleware, listener middleware and thunks. Symptoms:

* Prop-drilling of callbacks; ad-hoc contexts just to make one component call another.
* Side-effects glued to UI components.
* A single scenario ("message arrived → not the active channel → badge + sound + toast") scattered across three features.
* No way to see at a glance _what will happen when X occurs_.

Triggery's answer: **a scenario is one file**. The file reads like a spec.

## Status

Pre-MVP (Phase 1). Roadmap to 1.0 is tracked in the planning doc.

## License

MIT &copy; Aleksey Skhomenko
