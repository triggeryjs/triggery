# Triggery — WebSocket sync (Vite + React)

A simulated WebSocket frame fans out to three independent reactors:

1. **Append to message cache** — always, for the active conversation view.
2. **Increment unread badge** — only when the channel is *not* the active one.
3. **Toast** — only when DND is off.

The fake socket fires every 2 seconds. Switch the active tab or toggle DND — the trigger's gates re-evaluate on the next fire because conditions are pulled lazily.

## Try it

- <a href="https://triggeryjs.github.io/play/vite-react-websocket-sync/" target="_blank" rel="noopener noreferrer"><b>Open in StackBlitz</b></a>
- <a href="https://triggeryjs.github.io/recipes/react/websocket-sync/" target="_blank" rel="noopener noreferrer"><b>Read the recipe</b></a>

Or run it locally:

```bash
pnpm install
pnpm dev
```
