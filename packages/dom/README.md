# @triggery/dom

DOM bridges for Triggery — pipe `addEventListener`, `ResizeObserver` and `IntersectionObserver` into triggers.

## Install

```bash
pnpm add @triggery/core @triggery/react @triggery/dom
```

## Hooks

### `useDomEvent(trigger, eventName, target, domEventName, options?)`

Forward a DOM event into a Triggery event. `target` may be:

* an `EventTarget` (e.g. `window`, `document`, an element you already hold)
* a React ref (`useRef<HTMLElement>(null)`) — attachment is deferred until the ref resolves
* `null` / `undefined` — no-op until you provide a target

```tsx
function Input() {
  const ref = useRef<HTMLInputElement>(null);
  useDomEvent(chatTrigger, 'submit', ref, 'keydown', {
    mapPayload: (e) => ({ key: (e as KeyboardEvent).key }),
    listenerOptions: { passive: true },
  });
  return <input ref={ref} />;
}

function GlobalEscapeWatcher() {
  useDomEvent(uiTrigger, 'escape', window, 'keydown', {
    mapPayload: (e) => (e as KeyboardEvent).key,
  });
  return null;
}
```

### `useResizeObserver(trigger, eventName, ref, options?)`

```tsx
function Panel() {
  const ref = useRef<HTMLDivElement>(null);
  useResizeObserver(layoutTrigger, 'panel-resized', ref, {
    mapPayload: (e) => ({ width: e.contentRect.width, height: e.contentRect.height }),
  });
  return <div ref={ref}>…</div>;
}
```

### `useIntersectionObserver(trigger, eventName, ref, options?)`

```tsx
function VirtualRow() {
  const ref = useRef<HTMLLIElement>(null);
  useIntersectionObserver(virtualTrigger, 'row-visible', ref, {
    rootMargin: '200px',
    mapPayload: (e) => ({ visible: e.isIntersecting, ratio: e.intersectionRatio }),
  });
  return <li ref={ref}>…</li>;
}
```

## How it works

All three hooks attach in `useEffect` (commit phase, StrictMode-safe) and detach on unmount or when their inputs change. Listener identity is stable across renders unless `mapPayload`/`listenerOptions`/`target` actually change, so React doesn't tear down on every render.

The trigger's event payload type defines what `mapPayload` should produce. If `mapPayload` is omitted, the raw DOM event / observer entry is forwarded unchanged.

## License

MIT
