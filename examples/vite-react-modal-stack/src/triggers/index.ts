import { createTrigger } from '@triggery/core';

export type ModalSpec = {
  id: string;
  title: string;
  body: string;
  triggerEl?: HTMLElement | null;
};

export const modalTrigger = createTrigger<{
  events: {
    'modal:open': ModalSpec;
    'modal:close': string;
  };
  conditions: { stack: ModalSpec[] };
  actions: {
    setStack: ModalSpec[];
    restoreFocus: HTMLElement | null;
    setScrollLock: boolean;
  };
}>({
  id: 'modal-coordinator',
  events: ['modal:open', 'modal:close'],
  required: ['stack'],
  handler({ event, conditions, actions }) {
    const stack = conditions.stack ?? [];
    if (event.name === 'modal:open') {
      actions.setStack?.([...stack, event.payload]);
      actions.setScrollLock?.(true);
    } else {
      const next = stack.filter((m) => m.id !== event.payload);
      const closing = stack.find((m) => m.id === event.payload);
      actions.setStack?.(next);
      actions.restoreFocus?.(closing?.triggerEl ?? null);
      if (next.length === 0) actions.setScrollLock?.(false);
    }
  },
});
