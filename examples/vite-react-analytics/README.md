# Triggery — analytics fan-out (Vite + React)

Producers fire one typed analytics event. Three reactors — Segment, Amplitude, GA4 — each own their SDK and decide independently whether they're active. Adding or removing a provider is one component, no rewiring.

## Try it

- <a href="https://triggeryjs.github.io/play/vite-react-analytics/" target="_blank" rel="noopener noreferrer"><b>Open in StackBlitz</b></a>
- <a href="https://triggeryjs.github.io/recipes/react/analytics/" target="_blank" rel="noopener noreferrer"><b>Read the recipe</b></a>

Or run it locally:

```bash
pnpm install
pnpm dev
```
