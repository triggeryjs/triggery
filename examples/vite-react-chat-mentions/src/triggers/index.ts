import { createTrigger } from '@triggery/core';

export type Mention = { id: string; user: string; message: string };

export const mentionTrigger = createTrigger<{
  events: {
    'chat:mention': Mention;
    'chat:webhook-response': { id: string; ok: boolean; reason?: string };
  };
  conditions: { webhookEnabled: boolean };
  actions: {
    appendMention: Mention;
    callWebhook: Mention;
    toastSuccess: string;
    toastError: { id: string; reason: string };
  };
}>({
  id: 'chat-mention-pipeline',
  events: ['chat:mention', 'chat:webhook-response'],
  required: ['webhookEnabled'],
  handler({ event, conditions, actions, check }) {
    if (event.name === 'chat:mention') {
      actions.appendMention?.(event.payload);
      if (check.is('webhookEnabled', (v) => v)) {
        actions.callWebhook?.(event.payload);
      }
      return;
    }
    // chat:webhook-response
    if (event.payload.ok) actions.toastSuccess?.(`Webhook delivered for ${event.payload.id}`);
    else actions.toastError?.({ id: event.payload.id, reason: event.payload.reason ?? 'Unknown' });
  },
});
