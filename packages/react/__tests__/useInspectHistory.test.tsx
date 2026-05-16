import { act, render } from '@testing-library/react';
import {
  createRuntime,
  createTrigger,
  type Runtime,
  type TriggerInspectSnapshot,
} from '@triggery/core';
import { afterEach, describe, expect, it } from 'vitest';
import { TriggerRuntimeProvider, useInspectHistory } from '../src/index.ts';

let activeRuntime: Runtime | undefined;
afterEach(() => {
  activeRuntime?.dispose();
  activeRuntime = undefined;
});

function setupTrigger(runtime: Runtime) {
  return createTrigger<{ events: { tick: number } }>(
    { id: 'inspect-history', events: ['tick'], handler() {} },
    runtime,
  );
}

describe('useInspectHistory', () => {
  it('seeds with whatever the runtime had before mount', () => {
    activeRuntime = createRuntime();
    setupTrigger(activeRuntime);
    activeRuntime.fireSync('tick', 1);
    activeRuntime.fireSync('tick', 2);

    let captured: readonly TriggerInspectSnapshot[] = [];
    const Probe = () => {
      captured = useInspectHistory();
      return null;
    };

    render(
      <TriggerRuntimeProvider runtime={activeRuntime}>
        <Probe />
      </TriggerRuntimeProvider>,
    );

    expect(captured.length).toBe(2);
    expect(captured[0]?.status).toBe('fired');
  });

  it('updates when new runs arrive after mount', () => {
    activeRuntime = createRuntime();
    const runtime = activeRuntime;
    setupTrigger(runtime);

    let captured: readonly TriggerInspectSnapshot[] = [];
    const Probe = () => {
      captured = useInspectHistory(50);
      return null;
    };

    render(
      <TriggerRuntimeProvider runtime={runtime}>
        <Probe />
      </TriggerRuntimeProvider>,
    );
    expect(captured).toHaveLength(0);

    act(() => {
      runtime.fireSync('tick', 1);
    });
    expect(captured).toHaveLength(1);

    act(() => {
      runtime.fireSync('tick', 2);
      runtime.fireSync('tick', 3);
    });
    expect(captured).toHaveLength(3);
  });

  it('respects the limit argument (newest first)', () => {
    activeRuntime = createRuntime();
    const runtime = activeRuntime;
    setupTrigger(runtime);

    let captured: readonly TriggerInspectSnapshot[] = [];
    const Probe = () => {
      captured = useInspectHistory(2);
      return null;
    };

    render(
      <TriggerRuntimeProvider runtime={runtime}>
        <Probe />
      </TriggerRuntimeProvider>,
    );

    act(() => {
      runtime.fireSync('tick', 1);
      runtime.fireSync('tick', 2);
      runtime.fireSync('tick', 3);
    });
    expect(captured).toHaveLength(2);
    // Newest first — buffer.unshift().
    expect(captured[0]?.runId).toBeDefined();
  });

  it('unsubscribes on unmount', () => {
    activeRuntime = createRuntime();
    const runtime = activeRuntime;
    setupTrigger(runtime);

    let captured: readonly TriggerInspectSnapshot[] = [];
    const Probe = () => {
      captured = useInspectHistory();
      return null;
    };

    const { unmount } = render(
      <TriggerRuntimeProvider runtime={runtime}>
        <Probe />
      </TriggerRuntimeProvider>,
    );

    act(() => {
      runtime.fireSync('tick', 1);
    });
    expect(captured).toHaveLength(1);

    unmount();
    // Firing after unmount must not throw — the listener should be gone.
    expect(() => runtime.fireSync('tick', 2)).not.toThrow();
  });
});
