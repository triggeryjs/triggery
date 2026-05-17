# Triggery — modal stack (Vite + React)

One trigger coordinates a stack of modals: open events push, close events pop. The same trigger also restores focus to the original opener and locks body scroll when the stack is non-empty.

Open Confirm-delete, then Resolve-conflict on top — close them in reverse, watch focus return to the original button.

## Try it

- <a href="https://triggeryjs.github.io/play/vite-react-modal-stack/" target="_blank" rel="noopener noreferrer"><b>Open in StackBlitz</b></a>
- <a href="https://triggeryjs.github.io/recipes/react/modal-stack/" target="_blank" rel="noopener noreferrer"><b>Read the recipe</b></a>

Or run it locally:

```bash
pnpm install
pnpm dev
```
