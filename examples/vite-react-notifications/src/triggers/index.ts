import { createTrigger } from '@triggery/core';

type Settings = { sound: boolean; notifications: boolean; dnd: boolean };
type Message = {
  id: string;
  author: string;
  authorId: string;
  text: string;
  channelId: string;
};

export const messageTrigger = createTrigger<{
  events: { 'new-message': Message };
  conditions: {
    settings: Settings;
    activeChannelId: string | null;
    currentUserId: string;
  };
  actions: {
    showToast: { title: string; body: string };
    playSound: 'beep' | 'mention';
    incrementBadge: string;
  };
}>({
  id: 'message-received',
  events: ['new-message'],
  required: ['settings', 'currentUserId'],
  handler({ event, conditions, actions, check }) {
    const msg = event.payload;
    if (msg.channelId === conditions.activeChannelId) return;
    if (msg.authorId === conditions.currentUserId) return;

    if (check.is('settings', (s) => s.notifications)) {
      actions.showToast?.({ title: msg.author, body: msg.text });
    }
    if (check.is('settings', (s) => s.sound && !s.dnd)) {
      actions.debounce(800).playSound?.('beep');
    }
    actions.incrementBadge?.(msg.channelId);
  },
});
