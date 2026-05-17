import { createTrigger } from '@triggery/core';

type Message = { id: string; channelId: string; author: string; text: string };

export const wsMessageTrigger = createTrigger<{
  events: { 'ws:new-message': Message };
  conditions: { activeChannelId: string | null; dnd: boolean };
  actions: {
    appendToCache: Message;
    incrementUnread: string;
    toast: { title: string; body: string };
  };
}>({
  id: 'ws-message-fanout',
  events: ['ws:new-message'],
  required: ['activeChannelId'],
  handler({ event, conditions, actions, check }) {
    const msg = event.payload;
    // Always append to the cache — UI may render stale conversations.
    actions.appendToCache?.(msg);

    if (msg.channelId !== conditions.activeChannelId) {
      actions.incrementUnread?.(msg.channelId);
    }
    if (!check.is('dnd', (v) => v)) {
      actions.toast?.({ title: msg.author, body: msg.text });
    }
  },
});
