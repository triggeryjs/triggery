import { render } from '@testing-library/react';
import { createRuntime, createTrigger, type Runtime } from '@triggery/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TriggerRuntimeProvider, TriggerScope, useAction, useCondition } from '../src/index.ts';

type Schema = {
  events: { tick: number };
  conditions: { user: { id: string } };
  actions: { log: number };
};

let activeRuntime: Runtime | undefined;
afterEach(() => {
  activeRuntime?.dispose();
  activeRuntime = undefined;
});

describe('<TriggerScope> — wires React hooks to the scope-match gate', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('a scoped trigger receives registrations made inside the matching <TriggerScope>', () => {
    activeRuntime = createRuntime();
    const runtime = activeRuntime;
    const trigger = createTrigger<Schema>(
      {
        id: 'r-scoped',
        scope: 'chat',
        events: ['tick'],
        required: ['user'],
        handler: ({ event, conditions, actions }) => {
          if (!conditions.user) return;
          actions.log?.(event.payload);
        },
      },
      runtime,
    );

    const log = vi.fn();
    const Setup = () => {
      useCondition(trigger, 'user', () => ({ id: 'alice' }));
      useAction(trigger, 'log', log);
      return null;
    };

    render(
      <TriggerRuntimeProvider runtime={runtime}>
        <TriggerScope id="chat">
          <Setup />
        </TriggerScope>
      </TriggerRuntimeProvider>,
    );

    runtime.fireSync('tick', 7);
    expect(log).toHaveBeenCalledExactlyOnceWith(7);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('without a <TriggerScope>, registrations are global and a scoped trigger ignores them', () => {
    activeRuntime = createRuntime();
    const runtime = activeRuntime;
    const trigger = createTrigger<Schema>(
      {
        id: 'r-mismatch',
        scope: 'chat',
        events: ['tick'],
        handler: ({ actions, event }) => actions.log?.(event.payload),
      },
      runtime,
    );

    const log = vi.fn();
    const Setup = () => {
      useAction(trigger, 'log', log);
      return null;
    };

    render(
      <TriggerRuntimeProvider runtime={runtime}>
        <Setup />
      </TriggerRuntimeProvider>,
    );

    runtime.fireSync('tick', 1);
    expect(log).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    const msg = warnSpy.mock.calls[0]?.[0] as string;
    expect(msg).toContain('scope mismatch');
  });

  it('nested <TriggerScope> overrides the outer scope (last-writer-wins)', () => {
    activeRuntime = createRuntime();
    const runtime = activeRuntime;
    const triggerInner = createTrigger<Schema>(
      {
        id: 'r-nested',
        scope: 'inner',
        events: ['tick'],
        handler: ({ actions, event }) => actions.log?.(event.payload),
      },
      runtime,
    );

    const log = vi.fn();
    const Setup = () => {
      useAction(triggerInner, 'log', log);
      return null;
    };

    render(
      <TriggerRuntimeProvider runtime={runtime}>
        <TriggerScope id="outer">
          <TriggerScope id="inner">
            <Setup />
          </TriggerScope>
        </TriggerScope>
      </TriggerRuntimeProvider>,
    );

    runtime.fireSync('tick', 5);
    expect(log).toHaveBeenCalledExactlyOnceWith(5);
  });
});
