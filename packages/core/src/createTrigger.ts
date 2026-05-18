import { warnOnce } from './dev-warn.ts';
import { getDefaultRuntime } from './runtime.ts';
import type {
  ActionChannel,
  ActionKey,
  ActionMap,
  ConcurrencyStrategy,
  ConditionKey,
  ConditionMap,
  EventKey,
  InternalHandlerCtx,
  InternalTriggerConfig,
  NamedHooks,
  Runtime,
  SchedulerStrategy,
  Trigger,
  TriggerHandler,
  TriggerSchema,
} from './types.ts';

/**
 * Public trigger configuration.
 *
 * @remarks
 * **v0.10 update:** `conditions` lets you declare the trigger's conditions
 * inline; values are updated via the returned trigger's `setCondition`
 * method. The existing `runtime.registerCondition` path keeps working and
 * is the recommended low-level API for externally-owned values.
 *
 * **TypeScript narrowing of required conditions** is provided by the
 * builder API — see `createTrigger<Schema>()` (no args) → `.require(...).handle(...)`.
 * In the imperative form below, listed `required` keys are checked at runtime
 * but not narrowed at the type level — use an early return
 * (`if (!conditions.user) return;`) or `check.is('user', ...)` for typesafe
 * narrowing inside the handler.
 */
export type CreateTriggerConfig<S extends TriggerSchema> = {
  readonly id: string;
  readonly events: readonly EventKey<S>[];
  /** Required condition keys. The trigger will not run unless all of them are registered. */
  readonly required?: readonly ConditionKey<S>[];
  /**
   * Initial values for conditions held by this trigger.
   *
   * A condition counts as "set" when its value is non-null and non-undefined.
   * Triggers in `required: [...]` skip until every required key is set.
   *
   * Conditions registered both inline here AND via `runtime.registerCondition`
   * keep the inline value (config wins). A DEV warning fires once per conflict.
   */
  readonly conditions?: { readonly [K in ConditionKey<S>]?: ConditionMap<S>[K] | null };
  readonly schedule?: SchedulerStrategy;
  /**
   * Concurrency strategy applied across handler runs (default: `'take-latest'`).
   *
   * - `take-latest` — new run aborts the previous (`signal.aborted` becomes true).
   * - `take-every`  — every run proceeds independently, no aborts.
   * - `take-first` / `exhaust` — new runs are skipped while one is still in flight.
   * - `queue`       — new runs wait for the previous to finish (serialized).
   * - `sync`        — like `take-every`; provided as a documentation marker.
   */
  readonly concurrency?: ConcurrencyStrategy;
  readonly scope?: string;
  readonly handler: TriggerHandler<S, never>;
};

/**
 * Create a trigger and register it in a runtime (the default runtime if none is passed).
 *
 * @example
 * ```ts
 * const messageTrigger = createTrigger<{
 *   events: { 'new-message': { author: string; text: string } };
 *   conditions: { user: { id: string } | null; settings: { sound: boolean } | null };
 *   actions: { showToast: { title: string }; playSound: void };
 * }>({
 *   id: 'message-received',
 *   events: ['new-message'],
 *   conditions: { user: null, settings: null },
 *   required: ['user', 'settings'],
 *   handler({ event, conditions, actions, check }) {
 *     if (!conditions.user || !conditions.settings) return;
 *     if (check.is('settings', (s) => s.sound)) actions.playSound?.();
 *     actions.showToast?.({ title: event.payload.author });
 *   },
 * });
 *
 * messageTrigger.setCondition('user', { id: 'alice' });
 * messageTrigger.setCondition('settings', { sound: true });
 *
 * messageTrigger.action('showToast').subscribe((p) => console.log(p));
 * ```
 */
/**
 * Imperative form. Pass the trigger config; returns a live `Trigger<S>`
 * registered with the runtime. The chainable builder form lives in the
 * `@triggery/core/builder` subpath — import from there if you want
 * `createTrigger<S>().require(...).handle(...)` with auto-narrowing.
 */
export function createTrigger<S extends TriggerSchema>(
  config: CreateTriggerConfig<S>,
  runtime: Runtime = getDefaultRuntime(),
): Trigger<S> {
  const internalHandler = (ctx: InternalHandlerCtx) =>
    config.handler(ctx as unknown as Parameters<typeof config.handler>[0]);

  const internalConfig: InternalTriggerConfig = {
    id: config.id,
    schedule: config.schedule ?? 'microtask',
    concurrency: config.concurrency ?? 'take-latest',
    required: (config.required ?? []) as readonly string[],
    events: config.events as readonly string[],
    scope: config.scope ?? '',
    handler: internalHandler,
  };

  const token = runtime.registerTrigger(internalConfig);

  // ─── B1: trigger-owned conditions ────────────────────────────────────
  // Each declared condition gets a storage cell. The getter we register
  // with the runtime reads through the cell, so `setCondition` updates
  // are observed by subsequent fires without re-registering.
  const conditionCells = new Map<string, { value: unknown }>();
  if (config.conditions) {
    for (const name of Object.keys(config.conditions) as Array<keyof typeof config.conditions>) {
      const initial = config.conditions[name] ?? null;
      const cell = { value: initial };
      conditionCells.set(name as string, cell);
      runtime.registerCondition(config.id, name as string, () => cell.value, {
        scope: internalConfig.scope,
      });
    }
  }

  // ─── B2: action channels ─────────────────────────────────────────────
  // Each channel is cached per (trigger, name). subscribe() goes through the
  // runtime's additive `subscribeAction` path so that channel subscribers
  // and any traditional `runtime.registerAction(...)` handlers coexist —
  // the runtime invokes both on emit.
  type ChannelEntry = {
    channel: ActionChannel<unknown>;
    /** Live subscriber count (per-channel state, mirrored from the runtime). */
    count: number;
  };
  const channels = new Map<string, ChannelEntry>();
  let disposed = false;

  const getOrCreateChannel = (name: string): ActionChannel<unknown> => {
    const cached = channels.get(name);
    if (cached) return cached.channel;
    const entry: ChannelEntry = {
      count: 0,
      channel: {
        get subscribed() {
          return entry.count;
        },
        subscribe(cb) {
          if (disposed) {
            if (process.env.NODE_ENV !== 'production') {
              warnOnce(
                `action-subscribe-disposed:${config.id}:${name}`,
                `[triggery] trigger.action("${name}").subscribe on disposed trigger "${config.id}" — ignored.`,
              );
            }
            return () => {};
          }
          const token = runtime.subscribeAction(config.id, name, cb as (payload: unknown) => void, {
            scope: internalConfig.scope,
          });
          entry.count += 1;
          let detached = false;
          return () => {
            if (detached) return;
            detached = true;
            entry.count = Math.max(0, entry.count - 1);
            token.unregister();
          };
        },
      },
    };
    channels.set(name, entry);
    return entry.channel;
  };

  return {
    id: config.id,
    schedule: internalConfig.schedule,
    enable() {
      runtime.getTrigger(config.id)?.enable();
    },
    disable() {
      runtime.getTrigger(config.id)?.disable();
    },
    isEnabled() {
      return runtime.getTrigger(config.id)?.isEnabled() ?? false;
    },
    setCondition<K extends ConditionKey<S>>(name: K, value: ConditionMap<S>[K] | null) {
      if (disposed) {
        if (process.env.NODE_ENV !== 'production') {
          warnOnce(
            `setCondition-disposed:${config.id}:${String(name)}`,
            `[triggery] trigger.setCondition("${String(name)}") on disposed trigger "${config.id}" — ignored.`,
          );
        }
        return;
      }
      const cell = conditionCells.get(name as string);
      if (!cell) {
        if (process.env.NODE_ENV !== 'production') {
          warnOnce(
            `setCondition-undeclared:${config.id}:${String(name)}`,
            `[triggery] trigger.setCondition("${String(name)}") — "${String(name)}" was not declared in the conditions config of trigger "${config.id}". Use runtime.registerCondition for externally-sourced conditions.`,
          );
        }
        return;
      }
      cell.value = value;
    },
    action<K extends ActionKey<S>>(name: K): ActionChannel<ActionMap<S>[K]> {
      return getOrCreateChannel(name as string) as unknown as ActionChannel<ActionMap<S>[K]>;
    },
    inspect() {
      return runtime.getTrigger(config.id)?.inspect();
    },
    dispose() {
      disposed = true;
      // Runtime cleanup (unregisterTrigger drops the registry entry, which
      // takes the channelSubscribers Map down with it) handles the actual
      // subscriber teardown; reset our per-channel mirror counts.
      for (const entry of channels.values()) entry.count = 0;
      token.unregister();
    },
    namedHooks(): NamedHooks<S> {
      return new Proxy({} as NamedHooks<S>, {
        get() {
          throw new Error('[triggery] namedHooks requires @triggery/react (use createNamedHooks)');
        },
      });
    },
  };
}
