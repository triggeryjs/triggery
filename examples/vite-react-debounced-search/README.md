# Triggery — debounced search (Vite + React)

Autocomplete with three guarantees declared in *one* trigger:

- **300 ms debounce** — fast typing collapses to a single request.
- **`take-latest`** — every new event aborts the previous fetch via `signal`.
- **No race conditions** — late responses from canceled fetches never overwrite fresh results.

The producer is a 5-line `<SearchBox>`; the reactor a 5-line `<ResultList>`. Compare with the ~40-line `useEffect`-with-refs version usually needed.

## Try it

- <a href="https://triggeryjs.github.io/play/vite-react-debounced-search/" target="_blank" rel="noopener noreferrer"><b>Open in StackBlitz</b></a>
- <a href="https://triggeryjs.github.io/recipes/react/debounced-search/" target="_blank" rel="noopener noreferrer"><b>Read the recipe</b></a>

Or run it locally:

```bash
pnpm install
pnpm dev
```
