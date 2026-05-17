# Triggery — form validation at the producer boundary (Vite + React)

The form parses input through a Standard-Schema-shaped validator before firing the trigger event. The handler sees only fully-typed, validated payload — no try/catch in the rule itself.

The example uses an inline mini-validator to keep the dependency footprint zero, but you can plug in `zod` / `valibot` / `arktype` with the same `parse()` shape.

## Try it

- <a href="https://triggeryjs.github.io/play/vite-react-form-zod/" target="_blank" rel="noopener noreferrer"><b>Open in StackBlitz</b></a>
- <a href="https://triggeryjs.github.io/recipes/react/form-with-zod/" target="_blank" rel="noopener noreferrer"><b>Read the recipe</b></a>

Or run it locally:

```bash
pnpm install
pnpm dev
```
