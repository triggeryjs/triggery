# Triggery — chat mentions → webhook (Vite + React)

A `@mention` fires an async webhook. The reactor that calls the webhook fires a *follow-up event* with the result, which a second branch of the same trigger turns into success/error toasts.

Demonstrates the "action does work, then fires a follow-up event" cascade pattern. The trigger handler reads top-down as a spec.

## Try it

- **Open in StackBlitz** — <https://triggeryjs.github.io/play/vite-react-chat-mentions/>
- **Read the recipe** — <https://triggeryjs.github.io/recipes/react/chat-mentions/>

Or run it locally:

```bash
pnpm install
pnpm dev
```
