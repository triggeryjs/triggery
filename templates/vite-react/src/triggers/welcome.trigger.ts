import { createTrigger } from '@triggery/core';

/**
 * One-file scenario: a button fires the `greet` event, the gate checks the
 * `friendly` condition, and the `say` action renders the result. Three
 * independent components plug into the named ports — no shared store, no
 * useEffect chain.
 */
export const welcomeTrigger = createTrigger<{
  events: { greet: string };
  conditions: { friendly: boolean };
  actions: { say: string };
}>({
  id: 'welcome',
  events: ['greet'],
  required: ['friendly'],
  handler({ event, conditions, actions }) {
    if (!conditions.friendly) return;
    actions.say?.(`Hello at ${event.payload} — welcome to Triggery!`);
  },
});
