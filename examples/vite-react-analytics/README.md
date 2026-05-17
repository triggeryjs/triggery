# Triggery — analytics fan-out (Vite + React)

Producers fire one typed analytics event. Three reactors — Segment, Amplitude, GA4 — each own their SDK and decide independently whether they're active. Adding or removing a provider is one component, no rewiring.

## Try it

- **Open in StackBlitz** — <https://triggeryjs.github.io/play/vite-react-analytics/>
- **Read the recipe** — <https://triggeryjs.github.io/recipes/react/analytics/>

Or run it locally:

```bash
pnpm install
pnpm dev
```
