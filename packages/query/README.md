# @triggery/query

Read cached [TanStack Query](https://tanstack.com/query) data from a Triggery condition.

## Install

```bash
pnpm add @triggery/core @triggery/react @triggery/query @tanstack/query-core
# (or @tanstack/react-query which re-exports query-core)
```

## Usage

```tsx
import { QueryClient } from '@tanstack/query-core';
import { createTrigger } from '@triggery/core';
import { useQueryCondition } from '@triggery/query';

type User = { id: string; name: string };

const queryClient = new QueryClient();

const messageTrigger = createTrigger<{
  events: { 'new-message': { text: string; from: string } };
  conditions: { user: User };
  actions: { showToast: { body: string } };
}>({
  id: 'message-received',
  events: ['new-message'],
  required: ['user'],
  handler({ event, conditions, actions }) {
    if (event.payload.from === conditions.user.id) return;
    actions.showToast?.({ body: event.payload.text });
  },
});

function CurrentUserBridge() {
  useQueryCondition<User, typeof messageTrigger['schema'], 'user'>(
    messageTrigger,
    'user',
    queryClient,
    ['user', 'current'],
  );
  return null;
}
```

With a selector:

```ts
useQueryCondition(messageTrigger, 'user', queryClient, ['profile'], (p) => p?.user);
```

## How it works

Pull-only: `queryClient.getQueryData(key)` runs **only** when a trigger fires, not on every cache update. The host component is never subscribed to the query — use `useQuery` / `useQueryClient` alongside in components that render the data.

When the cache entry is missing, the condition value is `undefined`, which fails a `required` gate cleanly and skips the handler instead of throwing.

## API

```ts
useQueryCondition<T, S, K>(
  trigger: Trigger<S>,
  name: K,
  queryClient: { getQueryData<T>(key): T | undefined },
  queryKey: readonly unknown[],
  selector?: (data: T | undefined) => ConditionMap<S>[K] | undefined,
): void
```

## Documentation

Full documentation, recipes and API reference at [https://triggeryjs.github.io/packages/query/](https://triggeryjs.github.io/packages/query/).

## Related packages

- [`@triggery/core`](https://www.npmjs.com/package/@triggery/core) — Required peer.
- [`@triggery/react`](https://www.npmjs.com/package/@triggery/react) — Required peer.
- [`@triggery/zustand`](https://www.npmjs.com/package/@triggery/zustand) — Adapter for non-server state.
- [`@triggery/redux`](https://www.npmjs.com/package/@triggery/redux) — Adapter for non-server state.

See the [full package list](https://github.com/triggeryjs/triggery#packages) in the repo README.

## License

MIT &copy; Aleksey Skhomenko
