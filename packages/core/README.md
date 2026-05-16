# @triggery/core

Core runtime for [Triggery](https://github.com/triggeryjs/triggery) — a declarative orchestration layer for React business logic.

This package contains:

- `createTrigger<Schema>(config)` — define a trigger.
- `createRuntime()` — isolated runtime (registry + scheduler + inspector).
- `getDefaultRuntime()` / `setDefaultRuntime()` — global singleton.
- Lifecycle middleware chain.
- Public types and helpers.

You usually do not consume this package directly — use [`@triggery/react`](../react).

## Install

```bash
pnpm add @triggery/core
```

## License

MIT &copy; Aleksey Skhomenko
