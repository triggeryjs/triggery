import { createTrigger } from '@triggery/core';

/**
 * Same entity rendered in two places — a diagram and a table — needs
 * bidirectional selection sync. Hovering a row should highlight the
 * matching node in the diagram, and vice versa.
 *
 * Without Triggery you end up with either:
 *   - lifted state in a parent component (couples the two panes), or
 *   - prop drilling of {selectedId, onSelect} all the way down, or
 *   - a shared store that turns into a god-object.
 *
 * With Triggery: a single typed event `entity:hover` / `entity:select` —
 * any pane can fire it, any pane can react to it. The reactors decorate
 * their own DOM; they never reach into a neighbour's tree.
 */
export const selectionTrigger = createTrigger<{
  events: {
    'entity:hover': string | null;
    'entity:select': string | null;
  };
  actions: {
    setHovered: string | null;
    setSelected: string | null;
  };
}>({
  id: 'entity-selection-sync',
  events: ['entity:hover', 'entity:select'],
  handler({ event, actions }) {
    if (event.name === 'entity:hover') {
      actions.setHovered?.(event.payload);
    } else {
      actions.setSelected?.(event.payload);
    }
  },
});
