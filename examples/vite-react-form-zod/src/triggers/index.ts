import { createTrigger } from '@triggery/core';

export type FormPayload = { email: string; age: number };

export const formTrigger = createTrigger<{
  events: { 'form:submitted': FormPayload };
  actions: { saveProfile: FormPayload; toast: string };
}>({
  id: 'profile-form',
  events: ['form:submitted'],
  async handler({ event, actions }) {
    // Producer already validated — the handler trusts the payload type.
    actions.saveProfile?.(event.payload);
    actions.toast?.(`Saved profile for ${event.payload.email}`);
  },
});
