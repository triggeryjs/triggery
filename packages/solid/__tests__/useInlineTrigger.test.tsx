/** @jsxImportSource solid-js */
import { cleanup, render } from '@solidjs/testing-library';
import { createRuntime } from '@triggery/core';
import { afterEach, describe, expect, it } from 'vitest';
import { TriggerRuntimeProvider, useInlineTrigger } from '../src/index.ts';

afterEach(() => {
  cleanup();
});

describe('@triggery/solid — useInlineTrigger', () => {
  it('creates a one-off trigger that fires when its event is emitted', () => {
    const runtime = createRuntime();
    const seen: number[] = [];

    function Tap() {
      useInlineTrigger<{ events: { 'cta:click': number } }>({
        on: 'cta:click',
        do: ({ event }) => {
          seen.push(event.payload as number);
        },
      });
      return null;
    }

    render(() => (
      <TriggerRuntimeProvider runtime={runtime}>
        <Tap />
      </TriggerRuntimeProvider>
    ));

    runtime.fireSync('cta:click', 1);
    runtime.fireSync('cta:click', 2);
    expect(seen).toEqual([1, 2]);
  });

  it('disposes the inline trigger on unmount — no further fires reach the handler', () => {
    const runtime = createRuntime();
    const seen: number[] = [];

    function Tap() {
      useInlineTrigger<{ events: { 'cta:click': number } }>({
        on: 'cta:click',
        do: ({ event }) => {
          seen.push(event.payload as number);
        },
      });
      return null;
    }

    const { unmount } = render(() => (
      <TriggerRuntimeProvider runtime={runtime}>
        <Tap />
      </TriggerRuntimeProvider>
    ));

    runtime.fireSync('cta:click', 1);
    unmount();
    runtime.fireSync('cta:click', 2);
    expect(seen).toEqual([1]);
  });
});
