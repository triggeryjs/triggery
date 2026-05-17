# Triggery — chat mentions → webhook (Vite + React)

A `@mention` fires an async webhook. The reactor that calls the webhook fires a *follow-up event* with the result, which a second branch of the same trigger turns into success/error toasts.

Demonstrates the "action does work, then fires a follow-up event" cascade pattern. The trigger handler reads top-down as a spec.

## Try it

- <a href="https://triggeryjs.github.io/play/vite-react-chat-mentions/" target="_blank" rel="noopener noreferrer"><b>Open in StackBlitz</b></a>
- <a href="https://triggeryjs.github.io/recipes/react/chat-mentions/" target="_blank" rel="noopener noreferrer"><b>Read the recipe</b></a>

Or run it locally:

```bash
pnpm install
pnpm dev
```
