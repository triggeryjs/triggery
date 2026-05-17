import { createTrigger } from '@triggery/core';

type Settings = { notifications: boolean };

export const messageTrigger = createTrigger<{
  events: { 'new-message': { author: string; text: string } };
  conditions: { settings: Settings };
  actions: { showToast: { title: string; body: string } };
}>({
  id: 'message-received',
  events: ['new-message'],
  required: ['settings'],
  handler({ event, conditions, actions }) {
    if (!conditions.settings.notifications) return;
    actions.showToast?.({ title: event.payload.author, body: event.payload.text });
  },
});
