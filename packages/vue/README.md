# @triggery/vue

[Vue 3](https://vuejs.org) bindings for Triggery. Same `useEvent` / `useCondition` / `useAction` shape as `@triggery/react`, native to Vue's Composition API and `effectScope`.

## Install

```bash
pnpm add @triggery/core @triggery/vue vue
```

## Usage

```vue
<!-- App.vue -->
<script setup lang="ts">
import { createRuntime } from '@triggery/core';
import { TriggerRuntimeProvider } from '@triggery/vue';

const runtime = createRuntime();
</script>

<template>
  <TriggerRuntimeProvider :runtime="runtime">
    <SettingsProvider />
    <Chat />
    <Toast />
  </TriggerRuntimeProvider>
</template>
```

```ts
// messageTrigger.ts
import { createTrigger } from '@triggery/core';

export type Settings = { sound: boolean; notifications: boolean };

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
    actions.showToast?.({ title: event.payload.author, body: event.payload.text });
  },
});
```

```vue
<!-- SettingsProvider.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useCondition } from '@triggery/vue';
import { messageTrigger, type Settings } from './messageTrigger';

const settings = ref<Settings>({ sound: true, notifications: true });
useCondition(messageTrigger, 'settings', () => settings.value);
</script>

<template></template>
```

```vue
<!-- Chat.vue -->
<script setup lang="ts">
import { useEvent } from '@triggery/vue';
import { messageTrigger } from './messageTrigger';

const fire = useEvent(messageTrigger, 'new-message');
</script>

<template>
  <button @click="fire({ text: 'hi', author: 'Alice' })">send</button>
</template>
```

```vue
<!-- Toast.vue -->
<script setup lang="ts">
import { useAction } from '@triggery/vue';
import { messageTrigger } from './messageTrigger';

useAction(messageTrigger, 'showToast', ({ title, body }) => {
  console.log(`[${title}] ${body}`);
});
</script>

<template></template>
```

## API

### `<TriggerRuntimeProvider :runtime>` / `provideTriggerRuntime(runtime)`

Provide a runtime to descendants via Vue's `provide` system. Either form works — use the component when wrapping templates, the function when wiring up in a root setup script.

### `<TriggerScope :id>` / `provideTriggerScope(id)`

Scope subsequent condition / action registrations. Triggers declared with the matching `scope` see registrations from inside; global triggers see only registrations from outside any scope.

### `useEvent(trigger, eventName)`

Returns a stable function that fires the event.

### `useCondition(trigger, name, getter)`

Register a condition getter that the runtime calls at fire time. Pull-only — no `watch`, no per-render subscription. Read refs naturally inside the getter (`() => myRef.value`). The host component is never re-rendered because of this composable.

### `useAction(trigger, name, handler)`

Register an action handler.

## Cleanup

All composables auto-clean via `onScopeDispose` — they work both inside component `setup()` and inside detached `effectScope()`s.

## License

MIT
