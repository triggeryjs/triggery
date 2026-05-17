# Triggery — WebSocket sync (Vite + React)

A simulated WebSocket frame fans out to three independent reactors:

1. **Append to message cache** — always, for the active conversation view.
2. **Increment unread badge** — only when the channel is *not* the active one.
3. **Toast** — only when DND is off.

The fake socket fires every 2 seconds. Switch the active tab or toggle DND — the trigger's gates re-evaluate on the next fire because conditions are pulled lazily.

```bash
pnpm install
pnpm dev
```
