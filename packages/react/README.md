# @triggery/react

React bindings for [Triggery](https://github.com/triggeryjs/triggery).

Provides:

- `useEvent(trigger, 'eventName')` — get a typed event emitter.
- `useCondition(trigger, 'name', () => value, [deps])` — register pull-based condition data.
- `useAction(trigger, 'name', handler)` — register an action executor.
- `useInlineTrigger({ on, do, if?, required? })` — define an inline trigger inside a component.
- `<TriggerScope id="...">` — isolate registrations to a scope.
- `<TriggerRuntimeProvider runtime={...}>` — attach a custom runtime.

## Install

```bash
pnpm add @triggery/react @triggery/core
```

## License

MIT &copy; Aleksey Skhomenko
