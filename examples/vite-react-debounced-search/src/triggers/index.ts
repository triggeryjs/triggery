import { createTrigger } from '@triggery/core';

export type Hit = { id: string; label: string };

export const searchTrigger = createTrigger<{
  events: { 'search-query': string };
  actions: { setResults: Hit[]; setStatus: 'idle' | 'loading' | 'error' };
}>({
  id: 'search',
  events: ['search-query'],
  concurrency: 'take-latest',
  async handler({ event, actions, signal }) {
    const q = event.payload.trim();
    if (!q) {
      actions.setResults?.([]);
      actions.setStatus?.('idle');
      return;
    }
    actions.setStatus?.('loading');
    try {
      // Fake API — debounce + take-latest still apply
      await new Promise((r) => setTimeout(r, 400));
      if (signal.aborted) return;
      const hits: Hit[] = Array.from({ length: 5 }, (_, i) => ({
        id: `${q}-${i}`,
        label: `Result ${i + 1} for "${q}"`,
      }));
      actions.setResults?.(hits);
      actions.setStatus?.('idle');
    } catch {
      if (signal.aborted) return;
      actions.setStatus?.('error');
    }
  },
});
