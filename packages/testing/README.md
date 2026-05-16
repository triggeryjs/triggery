# @triggery/testing

Testing utilities for [Triggery](https://github.com/triggeryjs/triggery).

Provides:

- `createTestRuntime({ triggers })` — isolated runtime for tests.
- `mockCondition(name, value)` / `mockAction(name, fn)` — replace ports without rendering React.
- `fakeScheduler` — control time (advance, flush).
- Vitest and Jest adapters.

## Install

```bash
pnpm add -D @triggery/testing
```

## License

MIT &copy; Aleksey Skhomenko
