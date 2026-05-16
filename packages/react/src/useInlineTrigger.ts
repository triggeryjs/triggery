import { createTrigger, type Trigger, type TriggerSchema } from '@triggery/core';
import { useEffect, useMemo, useRef } from 'react';
import { useRuntime } from './context.ts';

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
 * Define a trigger inline inside a component — an escape hatch for one-off
 * reactions where pulling them into a separate `*.trigger.ts` file would be
 * overkill. The trigger lives for the lifetime of the component (created on
 * mount, disposed on unmount).
 *
 * Use cases: tiny analytics taps, modal-stack coordination scoped to one screen,
 * keyboard shortcuts that only matter while a panel is open.
 *
 * For anything reusable across the app — prefer `createTrigger` in a dedicated
 * `*.trigger.ts` file.
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
  // Stable id — auto-generated unless the caller pinned one.
  const idRef = useRef<string | undefined>(undefined);
  if (idRef.current === undefined) {
    idRef.current = config.id ?? `inline:${(++inlineCounter).toString(36)}`;
  }

  // Keep the latest handler in a ref so the runtime always calls the freshest
  // body (closure capture without re-creating the trigger on every render).
  const handlerRef = useRef(config.do);
  handlerRef.current = config.do;

  const stableHandler = useMemo(
    () => ((ctx: Parameters<typeof config.do>[0]) => handlerRef.current(ctx)) as typeof config.do,
    [],
  );

  // Capture event-name at first render — runtime needs the index built upfront.
  const eventNameRef = useRef(config.on);
  if (eventNameRef.current !== config.on) {
    // DEV-only sanity: changing `on` between renders is a misuse.
    const env = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
      ?.NODE_ENV;
    if (env !== 'production') {
      // eslint-disable-next-line no-console -- DEV warn
      console.warn(
        `[triggery] useInlineTrigger(${idRef.current}): "on" must be stable between renders ` +
          `(got "${String(config.on)}" but was "${String(eventNameRef.current)}")`,
      );
    }
  }

  useEffect(() => {
    const trigger = createTrigger<S>(
      {
        id: idRef.current as string,
        // biome-ignore lint/suspicious/noExplicitAny: inline trigger has runtime-only schema
        events: [eventNameRef.current] as any,
        handler: stableHandler,
      },
      runtime,
    ) as Trigger<S>;
    return () => trigger.dispose();
  }, [runtime, stableHandler]);
}
