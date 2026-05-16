import type { Runtime } from '@triggery/core';
import { defineComponent, type PropType, type Slot } from 'vue';
import { provideTriggerRuntime, provideTriggerScope } from './context.ts';

/**
 * Helper that satisfies both TS strict (`noPropertyAccessFromIndexSignature`)
 * and Biome (`useLiteralKeys`) — Vue's `Slots` type uses an index signature
 * so a direct `.default` access trips one rule or the other.
 */
function defaultSlot(slots: { readonly default?: Slot }): Slot | undefined {
  return slots.default;
}

/**
 * Provide a runtime to descendants via Vue's `provide` system. Renders its
 * default slot unchanged — pure DI wrapper, no template overhead.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { createRuntime } from '@triggery/core';
 * import { TriggerRuntimeProvider } from '@triggery/vue';
 *
 * const runtime = createRuntime();
 * </script>
 *
 * <template>
 *   <TriggerRuntimeProvider :runtime="runtime">
 *     <Chat />
 *   </TriggerRuntimeProvider>
 * </template>
 * ```
 */
export const TriggerRuntimeProvider = defineComponent({
  name: 'TriggerRuntimeProvider',
  props: {
    runtime: { type: Object as PropType<Runtime>, required: true },
  },
  setup(props, { slots }) {
    provideTriggerRuntime(props.runtime);
    const slot = defaultSlot(slots);
    return () => slot?.();
  },
});

/**
 * Scope subsequent condition / action registrations. Only triggers declared
 * with the matching `scope` id see registrations made inside this component.
 *
 * @example
 * ```vue
 * <template>
 *   <TriggerScope id="chat">
 *     <ChatPanel />
 *   </TriggerScope>
 * </template>
 * ```
 */
export const TriggerScope = defineComponent({
  name: 'TriggerScope',
  props: {
    id: { type: String, required: true },
  },
  setup(props, { slots }) {
    provideTriggerScope(props.id);
    const slot = defaultSlot(slots);
    return () => slot?.();
  },
});
