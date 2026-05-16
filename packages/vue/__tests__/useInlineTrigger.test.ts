import { createRuntime } from '@triggery/core';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { TriggerRuntimeProvider, useInlineTrigger } from '../src/index.ts';

describe('@triggery/vue — useInlineTrigger', () => {
  it('reacts to its event for the lifetime of the component', () => {
    const runtime = createRuntime();
    const seen: number[] = [];

    const Tap = defineComponent({
      setup() {
        useInlineTrigger<{ events: { 'cta:click': number } }>({
          on: 'cta:click',
          do: ({ event }) => {
            seen.push(event.payload as number);
          },
        });
        return () => null;
      },
    });

    const wrapper = mount(TriggerRuntimeProvider, {
      props: { runtime },
      slots: { default: () => h(Tap) },
    });

    runtime.fireSync('cta:click', 1);
    runtime.fireSync('cta:click', 2);
    expect(seen).toEqual([1, 2]);

    wrapper.unmount();
    runtime.fireSync('cta:click', 99);
    expect(seen).toEqual([1, 2]);
  });
});
