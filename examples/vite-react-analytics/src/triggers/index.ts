import { createTrigger } from '@triggery/core';

type Provider = 'segment' | 'amplitude' | 'ga4';
type AnalyticsEvent = { name: string; props: Record<string, unknown> };

export const analyticsTrigger = createTrigger<{
  events: { 'analytics:track': AnalyticsEvent };
  conditions: { enabledProviders: Provider[] };
  actions: { sendSegment: AnalyticsEvent; sendAmplitude: AnalyticsEvent; sendGA4: AnalyticsEvent };
}>({
  id: 'analytics-fanout',
  events: ['analytics:track'],
  required: ['enabledProviders'],
  handler({ event, conditions, actions }) {
    const enabled = conditions.enabledProviders;
    if (enabled.includes('segment')) actions.sendSegment?.(event.payload);
    if (enabled.includes('amplitude')) actions.sendAmplitude?.(event.payload);
    if (enabled.includes('ga4')) actions.sendGA4?.(event.payload);
  },
});
