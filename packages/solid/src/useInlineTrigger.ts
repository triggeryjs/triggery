import { createTrigger, type Trigger, type TriggerSchema } from '@triggery/core';
import { onCleanup } from 'solid-js';
import { useRuntime, useScope } from './context.ts';

let inlineCounter = 0;

export type UseInlineTriggerConfig<S extends TriggerSchema> = {
  /** Event name to react to. Required. */
  readonly on: keyof NonNullable<S['events']> & string;
  /** Handler body. Receives the same context as a full `createTrigger` handler. */
  readonly do: Parameters<typeof createTrigger<S>>[0]['handler'];
  /** Optional debug id (defaults to a stable auto-generated one). */
  readonly id?: string;
};

/**
 * Define a trigger inline inside a Solid component — an escape hatch for one-off
 * reactions where pulling them into a separate `*.trigger.ts` file would be
 * overkill. The trigger lives for the lifetime of the component (created on
 * setup, disposed via `onCleanup`).
 *
 * Solid components only run setup once, so unlike the React variant there is
 * no ref/effect dance — the trigger is created immediately and the handler
 * closure captures whatever signals it references via normal Solid
 * reactivity.
 *
 * @example
 * ```tsx
 * useInlineTrigger<{ events: { 'cta:click': { id: string } } }>({
 *   on: 'cta:click',
 *   do: ({ event }) => track('cta', event.payload),
 * });
 * ```
 */
export function useInlineTrigger<S extends TriggerSchema>(config: UseInlineTriggerConfig<S>): void {
  const runtime = useRuntime();
  const scope = useScope();
  const id = config.id ?? `inline:${(++inlineCounter).toString(36)}`;
  const trigger = createTrigger<S>(
    {
      id,
      // biome-ignore lint/suspicious/noExplicitAny: inline trigger has runtime-only schema
      events: [config.on] as any,
      handler: config.do,
      ...(scope !== '' && { scope }),
    },
    runtime,
  ) as Trigger<S>;
  onCleanup(() => trigger.dispose());
}
