import { createTrigger } from '@triggery/core';

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
