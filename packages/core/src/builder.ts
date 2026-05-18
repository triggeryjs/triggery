/**
 * Builder subpath — `@triggery/core/builder`.
 *
 * Exports a chainable `createTrigger<S>()` form that narrows required
 * conditions to `NonNullable<...>` inside `.handle(...)`. Living in its
 * own subpath keeps the (~250 B gz) builder machinery out of the main
 * bundle for apps that only need the imperative `createTrigger({...})`
 * config form from `@triggery/core`.
 *
 * ```ts
 * import { createTrigger } from '@triggery/core/builder';
 *
 * const t = createTrigger<Schema>()
 *   .id('inbox')
 *   .events(['new-message'])
 *   .require('user')
 *   .handle(({ conditions }) => {
 *     // conditions.user: NonNullable<...>
 *   });
 * ```
 */

import { createTrigger as createTriggerImperative } from './createTrigger.ts';
import { getDefaultRuntime } from './runtime.ts';
import type {
  ConcurrencyStrategy,
  ConditionKey,
  ConditionMap,
  EventKey,
  Runtime,
  SchedulerStrategy,
  Trigger,
  TriggerBuilder,
  TriggerHandler,
  TriggerSchema,
} from './types.ts';

/** Returns a chainable `TriggerBuilder<S>`. See module docs for examples. */
export function createTrigger<S extends TriggerSchema>(runtime?: Runtime): TriggerBuilder<S> {
  return createBuilder<S>(runtime);
}

function createBuilder<S extends TriggerSchema>(runtime?: Runtime): TriggerBuilder<S> {
  const state: Partial<{
    id: string;
    events: readonly EventKey<S>[];
    required: readonly ConditionKey<S>[];
    conditions: { readonly [K in ConditionKey<S>]?: ConditionMap<S>[K] | null };
    schedule: SchedulerStrategy;
    concurrency: ConcurrencyStrategy;
    scope: string;
  }> = {};
  const builder: TriggerBuilder<S, never> = {
    id(id) {
      state.id = id;
      return builder as TriggerBuilder<S, never>;
    },
    events(events) {
      state.events = events;
      return builder as TriggerBuilder<S, never>;
    },
    require<K extends ConditionKey<S>>(...keys: readonly K[]): TriggerBuilder<S, K> {
      const prev = (state.required ?? []) as readonly ConditionKey<S>[];
      const next = [...prev];
      for (const k of keys) if (!next.includes(k)) next.push(k);
      state.required = next as readonly ConditionKey<S>[];
      return builder as unknown as TriggerBuilder<S, K>;
    },
    conditions(values) {
      state.conditions = { ...(state.conditions ?? {}), ...values };
      return builder as TriggerBuilder<S, never>;
    },
    schedule(strategy) {
      state.schedule = strategy;
      return builder as TriggerBuilder<S, never>;
    },
    concurrency(strategy) {
      state.concurrency = strategy;
      return builder as TriggerBuilder<S, never>;
    },
    scope(scope) {
      state.scope = scope;
      return builder as TriggerBuilder<S, never>;
    },
    handle(handler): Trigger<S> {
      if (state.id === undefined) {
        throw new Error('[triggery] createTrigger().handle: .id(...) was not called');
      }
      if (state.events === undefined) {
        throw new Error('[triggery] createTrigger().handle: .events(...) was not called');
      }
      return createTriggerImperative<S>(
        {
          id: state.id,
          events: state.events,
          handler: handler as TriggerHandler<S, never>,
          ...(state.required !== undefined && { required: state.required }),
          ...(state.conditions !== undefined && { conditions: state.conditions }),
          ...(state.schedule !== undefined && { schedule: state.schedule }),
          ...(state.concurrency !== undefined && { concurrency: state.concurrency }),
          ...(state.scope !== undefined && { scope: state.scope }),
        },
        runtime ?? getDefaultRuntime(),
      );
    },
  };
  return builder;
}
