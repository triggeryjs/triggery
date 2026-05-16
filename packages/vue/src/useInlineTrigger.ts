import { createTrigger, type Trigger, type TriggerSchema } from '@triggery/core';
import { onScopeDispose } from 'vue';
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
 * Define a trigger inline inside a Vue `setup()` — an escape hatch for one-off
 * reactions where pulling them into a separate `*.trigger.ts` file would be
 * overkill. The trigger lives until the surrounding effect scope disposes.
 *
 * @example
 * ```ts
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
  onScopeDispose(() => trigger.dispose());
}
