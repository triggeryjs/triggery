# Triggery — diagram ⇄ table selection sync (Vite + React)

The same entity is rendered twice — once in an SVG diagram, once in a table. Hover or click in either pane and the other pane reflects it.

Classically you'd solve this with one of:

1. **Lift selection state to a parent component** — couples diagram and table forever.
2. **Prop-drill `selectedId` + `onSelect` through every component in between** — boilerplate, leaks the concern.
3. **Shared store** — usually grows into a god-object over time.

Triggery lets the two panes only share a typed event:

```ts
events: {
  'entity:hover': string | null;
  'entity:select': string | null;
}
```

Either pane fires; either pane reacts. No prop drilling, no shared parent.

## Try it

- <a href="https://triggeryjs.github.io/play/vite-react-diagram-table-sync/" target="_blank" rel="noopener noreferrer"><b>Open in StackBlitz</b></a>
- <a href="https://triggeryjs.github.io/recipes/react/diagram-table-sync/" target="_blank" rel="noopener noreferrer"><b>Read the recipe</b></a>

Or run it locally:

```bash
pnpm install
pnpm dev
```
