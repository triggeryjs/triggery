import { createTrigger } from '@triggery/core';

/**
 * The whole scenario lives in this one file:
 *
 *   event:      'increment'   — button click
 *   condition:  'enabled'     — feature toggle from the UI
 *   action:     'notify'      — projection into a visible side effect
 *
 * Components don't know about each other. They only plug into named ports.
 *
 * v0.10 builder form — `.require('enabled')` narrows `conditions.enabled` to
 * `boolean`, so we don't write `conditions.enabled !== true` defensively.
 */
export const notificationTrigger = createTrigger<{
  events: { increment: number };
  conditions: { enabled: boolean };
  actions: { notify: { count: number } };
}>()
  .id('counter-notify')
  .events(['increment'])
  .conditions({ enabled: true })
  .require('enabled')
  .handle(({ event, conditions, actions }) => {
    if (!conditions.enabled) return;
    actions.notify?.({ count: event.payload });
  });
