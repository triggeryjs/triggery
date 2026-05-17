# Triggery — chat mentions → webhook (Vite + React)

A `@mention` fires an async webhook. The reactor that calls the webhook fires a *follow-up event* with the result, which a second branch of the same trigger turns into success/error toasts.

Demonstrates the "action does work, then fires a follow-up event" cascade pattern. The trigger handler reads top-down as a spec.

```bash
pnpm install
pnpm dev
```
