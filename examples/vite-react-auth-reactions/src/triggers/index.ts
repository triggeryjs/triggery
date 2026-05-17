import { createTrigger } from '@triggery/core';

export const authTrigger = createTrigger<{
  events: { 'auth:expired': void; 'auth:role-revoked': string };
  conditions: { isDirty: boolean; openRoutes: string[] };
  actions: {
    saveDraft: void;
    closeRoute: string;
    redirect: string;
    toast: string;
  };
}>({
  id: 'auth-reactions',
  events: ['auth:expired', 'auth:role-revoked'],
  required: ['isDirty', 'openRoutes'],
  handler({ event, conditions, actions, check }) {
    if (event.name === 'auth:expired') {
      if (check.is('isDirty', (v) => v)) {
        actions.saveDraft?.();
        actions.toast?.('Session expired — your changes were saved.');
      } else {
        actions.toast?.('Session expired. Redirecting to login.');
      }
      actions.redirect?.('/login');
      return;
    }
    // role-revoked
    const role = event.payload;
    for (const r of conditions.openRoutes) {
      if (r.startsWith(`/${role}/`)) actions.closeRoute?.(r);
    }
    actions.toast?.(`Role "${role}" revoked. Closed dependent screens.`);
  },
});
