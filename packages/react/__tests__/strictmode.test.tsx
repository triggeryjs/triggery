import { render } from '@testing-library/react';
import { createRuntime, createTrigger, type Runtime } from '@triggery/core';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TriggerRuntimeProvider, useAction, useCondition } from '../src/index.ts';

type Schema = {
  events: { ping: number };
  conditions: { token: string };
  actions: { use: number };
};

let activeRuntime: Runtime | undefined;
afterEach(() => {
  activeRuntime?.dispose();
  activeRuntime = undefined;
});

describe('React StrictMode — double mount', () => {
  it('double-mount keeps a single live registration on the action stack', () => {
    activeRuntime = createRuntime();
    const trigger = createTrigger<Schema>(
      {
        id: 'sm-action',
        events: ['ping'],
        required: ['token'],
        handler: ({ event, conditions, actions }) => {
          if (!conditions.token) return;
          actions.use?.(event.payload);
        },
      },
      activeRuntime,
    );

    const spy = vi.fn();
    const Provider = () => {
      useCondition(trigger, 'token', () => 'ok');
      return null;
    };
    const Action = () => {
      useAction(trigger, 'use', (n) => spy(n));
      return null;
    };

    render(
      <StrictMode>
        <TriggerRuntimeProvider runtime={activeRuntime}>
          <Provider />
          <Action />
        </TriggerRuntimeProvider>
      </StrictMode>,
    );
    // After StrictMode mount → unmount → mount the refcount stack keeps one
    // live entry. A single fire must call the action exactly once.
    activeRuntime.fireSync('ping', 7);
    expect(spy).toHaveBeenCalledExactlyOnceWith(7);
  });

  it('unmount while StrictMode-mounted twice still leaves the trigger usable', async () => {
    activeRuntime = createRuntime();
    const trigger = createTrigger<Schema>(
      {
        id: 'sm-unmount',
        events: ['ping'],
        required: ['token'],
        handler: ({ conditions, actions, event }) => {
          if (!conditions.token) return;
          actions.use?.(event.payload);
        },
      },
      activeRuntime,
    );
    const spy = vi.fn();
    const Provider = () => {
      useCondition(trigger, 'token', () => 'ok');
      return null;
    };
    const Action = () => {
      useAction(trigger, 'use', spy);
      return null;
    };

    const { unmount } = render(
      <StrictMode>
        <TriggerRuntimeProvider runtime={activeRuntime}>
          <Provider />
          <Action />
        </TriggerRuntimeProvider>
      </StrictMode>,
    );

    // Sanity: after StrictMode double-mount the registrations survive.
    activeRuntime.fireSync('ping', 1);
    expect(spy).toHaveBeenCalledExactlyOnceWith(1);

    unmount();
    activeRuntime.fireSync('ping', 2);
    // After unmount both Provider and Action are gone — required gate skips the trigger.
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
