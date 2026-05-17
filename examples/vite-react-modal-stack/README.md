# Triggery — modal stack (Vite + React)

One trigger coordinates a stack of modals: open events push, close events pop. The same trigger also restores focus to the original opener and locks body scroll when the stack is non-empty.

Open Confirm-delete, then Resolve-conflict on top — close them in reverse, watch focus return to the original button.

## Try it

- **Open in StackBlitz** — <https://triggeryjs.github.io/play/vite-react-modal-stack/>
- **Read the recipe** — <https://triggeryjs.github.io/recipes/react/modal-stack/>

Or run it locally:

```bash
pnpm install
pnpm dev
```
