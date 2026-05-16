import { act, cleanup, render, screen } from '@testing-library/react';
import { createRuntime, createTrigger, type Runtime } from '@triggery/core';
import { TriggerRuntimeProvider } from '@triggery/react';
import { afterEach, describe, expect, it } from 'vitest';
import { InspectorView, TriggerSnapshotView } from '../src/index.ts';

let activeRuntime: Runtime | undefined;
afterEach(() => {
  cleanup();
  activeRuntime?.dispose();
  activeRuntime = undefined;
});

describe('<TriggerSnapshotView>', () => {
  const baseSnapshot = {
    triggerId: 't1',
    runId: 'run_x',
    eventName: 'tick',
    status: 'fired' as const,
    durationMs: 1.234,
    executedActions: ['log', 'ping'],
    snapshotKeys: ['user'],
  };

  it('compact (default) shows triggerId, event and executed actions', () => {
    const { container } = render(<TriggerSnapshotView snapshot={baseSnapshot} />);
    expect(container.textContent).toContain('t1');
    expect(container.textContent).toContain('tick');
    expect(container.textContent).toContain('log, ping');
    expect(container.textContent).toContain('fired');
  });

  it('compact shows the skip reason when present', () => {
    const { container } = render(
      <TriggerSnapshotView
        snapshot={{
          ...baseSnapshot,
          status: 'skipped',
          reason: 'missing-required-condition:user',
          executedActions: [],
        }}
      />,
    );
    expect(container.textContent).toContain('missing-required-condition:user');
    expect(container.textContent).toContain('skipped');
  });

  it('full renders a complete formatted JSON snapshot', () => {
    const { container } = render(<TriggerSnapshotView snapshot={baseSnapshot} variant="full" />);
    const pre = container.querySelector('pre');
    expect(pre).not.toBeNull();
    const json = JSON.parse(pre!.textContent ?? '{}');
    expect(json).toMatchObject({ triggerId: 't1', status: 'fired' });
  });
});

describe('<InspectorView>', () => {
  it('renders an empty state when the buffer is empty', () => {
    activeRuntime = createRuntime();
    render(
      <TriggerRuntimeProvider runtime={activeRuntime}>
        <InspectorView />
      </TriggerRuntimeProvider>,
    );
    expect(screen.getByText(/No runs yet/i)).toBeDefined();
    expect(screen.getByText(/0 runs/)).toBeDefined();
  });

  it('lists runs as they happen and updates the counter', () => {
    activeRuntime = createRuntime();
    const runtime = activeRuntime;
    createTrigger<{ events: { tick: number } }>(
      { id: 'demo', events: ['tick'], handler() {} },
      runtime,
    );

    render(
      <TriggerRuntimeProvider runtime={runtime}>
        <InspectorView limit={5} />
      </TriggerRuntimeProvider>,
    );

    act(() => {
      runtime.fireSync('tick', 1);
      runtime.fireSync('tick', 2);
    });

    expect(screen.getByText(/2 runs/)).toBeDefined();
    // Snapshots have data attributes — easy to count without leaning on text.
    expect(document.querySelectorAll('[data-triggery-snapshot]').length).toBe(2);
  });

  it('clicking a row expands the full JSON view', async () => {
    activeRuntime = createRuntime();
    const runtime = activeRuntime;
    createTrigger<{ events: { tick: void } }>(
      { id: 'expand', events: ['tick'], handler() {} },
      runtime,
    );

    render(
      <TriggerRuntimeProvider runtime={runtime}>
        <InspectorView />
      </TriggerRuntimeProvider>,
    );

    act(() => {
      runtime.fireSync('tick');
    });

    // Before click — no <pre> in the document.
    expect(document.querySelector('pre')).toBeNull();
    const button = document.querySelector('button')!;
    act(() => {
      button.click();
    });
    expect(document.querySelector('pre')).not.toBeNull();
    expect(document.querySelector('pre')!.textContent).toContain('"triggerId": "expand"');
    // Second click collapses.
    act(() => {
      button.click();
    });
    expect(document.querySelector('pre')).toBeNull();
  });

  it('hides the header when title is null', () => {
    activeRuntime = createRuntime();
    render(
      <TriggerRuntimeProvider runtime={activeRuntime}>
        <InspectorView title={null} />
      </TriggerRuntimeProvider>,
    );
    expect(screen.queryByText('Triggery Inspector')).toBeNull();
  });
});
