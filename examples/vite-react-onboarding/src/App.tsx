import { useAction, useCondition, useEvent } from '@triggery/react';
import { useEffect, useState } from 'react';
import { onboardingTrigger } from './triggers/index.ts';

export function App() {
  const [step1Done, setStep1] = useState(false);
  const [step2Done, setStep2] = useState(false);
  const [tourDismissed, setDismissed] = useState(false);
  const [coachmark, setCoachmark] = useState<1 | 2 | null>(null);

  useCondition(onboardingTrigger, 'step1Done', () => step1Done, [step1Done]);
  useCondition(onboardingTrigger, 'step2Done', () => step2Done, [step2Done]);
  useCondition(onboardingTrigger, 'tourDismissed', () => tourDismissed, [tourDismissed]);

  useAction(onboardingTrigger, 'showCoachmark', setCoachmark);
  useAction(onboardingTrigger, 'hideCoachmark', () => setCoachmark(null));
  useAction(onboardingTrigger, 'saveStep', (step) => {
    if (step === 1) setStep1(true);
    if (step === 2) setStep2(true);
    if (step === 'tour-closed') setDismissed(true);
  });

  const fireEnter = useEvent(onboardingTrigger, 'route:dashboard-entered');
  const fireSearch = useEvent(onboardingTrigger, 'feature:search-used');
  const fireClose = useEvent(onboardingTrigger, 'tour:close');

  useEffect(() => {
    fireEnter();
  }, [fireEnter]);

  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: 24,
        maxWidth: 640,
        margin: '0 auto',
      }}
    >
      <h1>Triggery — onboarding tour</h1>
      <p>
        One trigger drives a two-step tour. Step 1 shows on dashboard entry; step 2 shows after the
        user first runs a search. Closing the tour permanently dismisses it.
      </p>
      <p>
        Status: {tourDismissed ? 'dismissed' : `step ${step1Done ? (step2Done ? 'done' : 2) : 1}`}
      </p>
      <button type="button" onClick={() => fireSearch()}>
        Use search feature
      </button>{' '}
      <button type="button" onClick={() => fireClose()}>
        Dismiss tour
      </button>
      <button
        type="button"
        onClick={() => {
          setStep1(false);
          setStep2(false);
          setDismissed(false);
          fireEnter();
        }}
        style={{ marginLeft: 16 }}
      >
        Reset
      </button>
      {coachmark && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: '#fff3cd',
            border: '1px solid #ffe082',
            borderRadius: 6,
          }}
        >
          <strong>Coachmark #{coachmark}</strong> —{' '}
          {coachmark === 1 ? 'Try the search feature.' : 'Save your filter as a preset.'}
          <button type="button" style={{ marginLeft: 12 }} onClick={() => setCoachmark(null)}>
            Got it
          </button>
        </div>
      )}
    </main>
  );
}
