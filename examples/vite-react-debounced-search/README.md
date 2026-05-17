# Triggery — debounced search (Vite + React)

Autocomplete with three guarantees declared in *one* trigger:

- **300 ms debounce** — fast typing collapses to a single request.
- **`take-latest`** — every new event aborts the previous fetch via `signal`.
- **No race conditions** — late responses from canceled fetches never overwrite fresh results.

The producer is a 5-line `<SearchBox>`; the reactor a 5-line `<ResultList>`. Compare with the ~40-line `useEffect`-with-refs version usually needed.

```bash
pnpm install
pnpm dev
```
