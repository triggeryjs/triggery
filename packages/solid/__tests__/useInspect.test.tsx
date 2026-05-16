/** @jsxImportSource solid-js */
import { cleanup, render } from '@solidjs/testing-library';
import { createRuntime, createTrigger } from '@triggery/core';
import { afterEach, describe, expect, it } from 'vitest';
import { TriggerRuntimeProvider, useInspect, useInspectHistory } from '../src/index.ts';

afterEach(() => {
  cleanup();
});

describe('@triggery/solid — useInspect / useInspectHistory', () => {
  it('useInspect returns an accessor over the latest snapshot', () => {
    const runtime = createRuntime();
    const trigger = createTrigger<{ events: { tick: number } }>(
      {
        id: 'inspect-1',
        events: ['tick'],
        handler: () => {},
      },
      runtime,
    );

    let read: () => { triggerId: string } | undefined = () => undefined;
    function Probe() {
      // biome-ignore lint/suspicious/noExplicitAny: snapshot shape is rich; tests only need triggerId.
      read = useInspect(trigger) as any;
      return null;
    }

    render(() => (
      <TriggerRuntimeProvider runtime={runtime}>
        <Probe />
      </TriggerRuntimeProvider>
    ));

    expect(read()).toBeUndefined();
    runtime.fireSync('tick', 1);
    expect(read()?.triggerId).toBe('inspect-1');
  });

  it('useInspectHistory updates as new runs are recorded', () => {
    const runtime = createRuntime();
    const trigger = createTrigger<{ events: { tick: number } }>(
      {
        id: 'inspect-history',
        events: ['tick'],
        handler: () => {},
      },
      runtime,
    );

    let history: () => readonly { triggerId: string }[] = () => [];
    function Probe() {
      // biome-ignore lint/suspicious/noExplicitAny: see above
      history = useInspectHistory(20) as any;
      return null;
    }

    render(() => (
      <TriggerRuntimeProvider runtime={runtime}>
        <Probe />
      </TriggerRuntimeProvider>
    ));

    expect(history().length).toBe(0);
    runtime.fireSync('tick', 1);
    runtime.fireSync('tick', 2);
    runtime.fireSync('tick', 3);
    expect(history().length).toBe(3);
    expect(history()[0]?.triggerId).toBe(trigger.id);
  });
});
