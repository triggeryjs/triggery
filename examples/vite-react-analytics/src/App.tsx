import { useAction, useCondition, useEvent } from '@triggery/react';
import { useState } from 'react';
import { analyticsTrigger } from './triggers/index.ts';

type Provider = 'segment' | 'amplitude' | 'ga4';

export function App() {
  const [enabled, setEnabled] = useState<Provider[]>(['segment', 'amplitude']);
  useCondition(analyticsTrigger, 'enabledProviders', () => enabled, [enabled]);

  const toggle = (p: Provider) =>
    setEnabled((arr) => (arr.includes(p) ? arr.filter((x) => x !== p) : [...arr, p]));

  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: 24,
        maxWidth: 640,
        margin: '0 auto',
      }}
    >
      <h1>Triggery — analytics fan-out</h1>
      <p>
        One typed event, three reactors. Each provider lives in its own component, owns its own SDK,
        and is toggled by a feature flag. Removing a provider = deleting one component.
      </p>
      <fieldset style={{ marginBottom: 16 }}>
        <legend>Active providers</legend>
        {(['segment', 'amplitude', 'ga4'] as Provider[]).map((p) => (
          <label key={p} style={{ marginRight: 16 }}>
            <input type="checkbox" checked={enabled.includes(p)} onChange={() => toggle(p)} /> {p}
          </label>
        ))}
      </fieldset>
      <Trackers />
      <Producer />
    </main>
  );
}

function Producer() {
  const fire = useEvent(analyticsTrigger, 'analytics:track');
  return (
    <section style={{ marginTop: 16 }}>
      <button
        type="button"
        onClick={() => fire({ name: 'button-clicked', props: { id: 'cta-hero', at: Date.now() } })}
      >
        Fire 'button-clicked'
      </button>{' '}
      <button
        type="button"
        onClick={() => fire({ name: 'page-viewed', props: { path: '/dashboard' } })}
      >
        Fire 'page-viewed'
      </button>
    </section>
  );
}

function Trackers() {
  const [log, setLog] = useState<string[]>([]);
  const record = (provider: string, e: { name: string; props: unknown }) =>
    setLog((arr) => [`[${provider}] ${e.name} ${JSON.stringify(e.props)}`, ...arr].slice(0, 10));
  useAction(analyticsTrigger, 'sendSegment', (e) => record('segment', e));
  useAction(analyticsTrigger, 'sendAmplitude', (e) => record('amplitude', e));
  useAction(analyticsTrigger, 'sendGA4', (e) => record('ga4', e));
  return (
    <section>
      <h3>Outgoing events</h3>
      <ul style={{ fontFamily: 'monospace', fontSize: 13 }}>
        {log.length === 0 && <li style={{ opacity: 0.6 }}>(no events yet)</li>}
        {log.map((l, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: demo
          <li key={i}>{l}</li>
        ))}
      </ul>
    </section>
  );
}
