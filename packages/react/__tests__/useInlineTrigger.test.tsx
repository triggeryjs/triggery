import { render } from '@testing-library/react';
import { createRuntime, type Runtime } from '@triggery/core';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TriggerRuntimeProvider, useInlineTrigger } from '../src/index.ts';

let activeRuntime: Runtime | undefined;
afterEach(() => {
  activeRuntime?.dispose();
  activeRuntime = undefined;
});

describe('useInlineTrigger', () => {
  it('reacts to fire and disposes on unmount', async () => {
    activeRuntime = createRuntime();
    const spy = vi.fn();
    const runtime = activeRuntime;

    const Probe = () => {
      useInlineTrigger<{ events: { 'inline:event': string } }>({
        id: 'inline-smoke',
        on: 'inline:event',
        do: ({ event }) => spy(event.payload),
      });

      useEffect(() => {
        runtime.fireSync('inline:event', 'hello');
      }, []);
      return null;
    };

    const { unmount } = render(
      <TriggerRuntimeProvider runtime={runtime}>
        <Probe />
      </TriggerRuntimeProvider>,
    );
    await Promise.resolve();
    expect(spy).toHaveBeenCalledExactlyOnceWith('hello');

    unmount();
    runtime.fireSync('inline:event', 'after-unmount');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
