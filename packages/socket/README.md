# @triggery/socket

Pipe socket.io events or native WebSocket messages into Triggery events.

## Install

```bash
pnpm add @triggery/core @triggery/react @triggery/socket
# Plus your client of choice:
pnpm add socket.io-client       # for useSocketIoEvent
# (or use the WHATWG WebSocket constructor available in browsers + Node 21+)
```

## Hooks

### `useSocketIoEvent(trigger, eventName, socket, socketEventName, options?)`

```tsx
import { io } from 'socket.io-client';
import { useSocketIoEvent } from '@triggery/socket';

const socket = io('https://example.com');

function MessageBridge() {
  useSocketIoEvent(messageTrigger, 'new-message', socket, 'message');
  return null;
}
```

With variadic args:

```ts
useSocketIoEvent(messageTrigger, 'new-message', socket, 'msg', {
  mapPayload: (from, text) => ({ from, text }),
});
```

### `useWebSocketEvent(trigger, eventName, ws, wsEvent, options?)`

```ts
import { useWebSocketEvent } from '@triggery/socket';

const ws = new WebSocket('wss://example.com');

function MessageBridge() {
  useWebSocketEvent(messageTrigger, 'new-message', ws, 'message', {
    mapPayload: (e) => JSON.parse((e as MessageEvent).data),
  });
  return null;
}
```

`wsEvent` accepts any string — typed for `'message' | 'open' | 'close' | 'error'` but extensible.

## How it works

Both hooks attach in `useEffect` (commit phase, StrictMode-safe) and detach on unmount or when their inputs change. If `socket` / `ws` is `null` or `undefined`, the hook is a no-op until you supply a connection — useful while the socket is being created asynchronously.

## Related packages

- [`@triggery/core`](https://www.npmjs.com/package/@triggery/core) — Required peer.
- [`@triggery/react`](https://www.npmjs.com/package/@triggery/react) — Required peer.
- [`@triggery/dom`](https://www.npmjs.com/package/@triggery/dom) — Alternative event source: DOM / ResizeObserver / IntersectionObserver.

See the [full package list](https://github.com/triggeryjs/triggery#packages) in the repo README.

## License

MIT &copy; Aleksey Skhomenko
