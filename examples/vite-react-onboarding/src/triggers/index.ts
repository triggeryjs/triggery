import { createTrigger } from '@triggery/core';

export const onboardingTrigger = createTrigger<{
  events: {
    'route:dashboard-entered': void;
    'feature:search-used': void;
    'tour:close': void;
  };
  conditions: { step1Done: boolean; step2Done: boolean; tourDismissed: boolean };
  actions: {
    showCoachmark: 1 | 2;
    hideCoachmark: void;
    saveStep: 1 | 2 | 'tour-closed';
  };
}>({
  id: 'onboarding-flow',
  events: ['route:dashboard-entered', 'feature:search-used', 'tour:close'],
  required: ['tourDismissed'],
  handler({ event, conditions, actions, check }) {
    if (check.is('tourDismissed', (v) => v)) return;

    if (event.name === 'tour:close') {
      actions.saveStep?.('tour-closed');
      actions.hideCoachmark?.();
      return;
    }
    if (event.name === 'route:dashboard-entered' && !conditions.step1Done) {
      actions.showCoachmark?.(1);
      return;
    }
    if (event.name === 'feature:search-used') {
      actions.saveStep?.(1);
      if (!conditions.step2Done) actions.showCoachmark?.(2);
    }
  },
});
