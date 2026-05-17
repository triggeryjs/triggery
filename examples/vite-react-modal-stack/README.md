# Triggery — modal stack (Vite + React)

One trigger coordinates a stack of modals: open events push, close events pop. The same trigger also restores focus to the original opener and locks body scroll when the stack is non-empty.

Open Confirm-delete, then Resolve-conflict on top — close them in reverse, watch focus return to the original button.

```bash
pnpm install
pnpm dev
```
