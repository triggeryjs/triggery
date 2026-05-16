# @triggery/testing

Testing utilities for [Triggery](https://github.com/triggeryjs/triggery). **Zero runtime dependencies. Framework-agnostic** — works the same in React, Solid, Vue tests, Node, or a worker; works with Vitest, Jest, and `node:test`.

## Install

```bash
pnpm add -D @triggery/testing
```

## What's in the box

- `createTestRuntime({ triggers? })` — isolated runtime per test (no global state pollution).
- `mockCondition(trigger, name, value | getter)` — supply a condition without rendering a component.
- `mockAction(trigger, name, fn)` — register an action handler (typically `vi.fn()` / `jest.fn()` / a closure).
- `flushMicrotasks()` — drain the default microtask scheduler before asserting.
- `createFakeScheduler()` — controllable virtual clock for `actions.debounce / throttle / defer`:
  - `install()` / `uninstall()` swap `globalThis.setTimeout` / `clearTimeout` for a controlled implementation.
  - `advance(ms)` runs every timer due within the window and drains microtasks.
  - `flushAll()` runs every pending timer regardless of scheduled time.
  - Test-runner agnostic — no dependency on `vi.useFakeTimers()`.

## Example

```ts
import { createTrigger } from '@triggery/core';
import { createTestRuntime } from '@triggery/testing';
import { expect, test, vi } from 'vitest';

test('mod with sound shows toast and plays sound', async () => {
  const rt = createTestRuntime();
  const t = createTrigger<{
    events: { 'new-message': string };
    conditions: { user: { isMod: boolean } };
    actions: { showToast: string; playSound: 'beep' | 'mod-alert' };
  }>(
    {
      id: 'msg',
      events: ['new-message'],
      required: ['user'],
      handler: ({ event, conditions, actions, check }) => {
        if (!check.is('user', (u) => u.isMod)) return;
        actions.showToast?.(event.payload);
        actions.playSound?.('mod-alert');
      },
    },
    rt,
  );

  rt.mockCondition(t, 'user', { isMod: true });
  const showToast = vi.fn();
  rt.mockAction(t, 'showToast', showToast);

  rt.fireSync('new-message', 'hi');
  expect(showToast).toHaveBeenCalledWith('hi');
});
```

## Related packages

- [`@triggery/core`](https://www.npmjs.com/package/@triggery/core) — Required peer — `createTestRuntime` wraps `createRuntime`.

See the [full package list](https://github.com/triggeryjs/triggery#packages) in the repo README.

## License

MIT &copy; Aleksey Skhomenko
