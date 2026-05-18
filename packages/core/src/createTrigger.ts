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
  TriggerBuilder,
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
 * Browser-safe DEV-mode detector (mirrored from runtime.ts so we don't
 * depend on its internals).
 */
const isDevEnv = (): boolean => {
  const env = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV;
  return env !== 'production';
};

/** Module-scoped one-shot DEV warning memo. Survives StrictMode mount cycles. */
const warnedOnce = new Set<string>();
const devWarnOnce = (key: string, message: string): void => {
  if (!isDevEnv()) return;
  if (warnedOnce.has(key)) return;
  warnedOnce.add(key);
  // eslint-disable-next-line no-console -- DEV warn
  console.warn(message);
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
 * Chainable form. Call with no arguments to get a `TriggerBuilder<S>`, then
 * chain `.id`, `.events`, `.require`, `.conditions`, `.schedule`,
 * `.concurrency`, `.scope` and finally `.handle(handler)`. The handler sees
 * required conditions narrowed to `NonNullable<...>` — no `!` operator, no
 * manual `if (!conditions.x) return;`.
 *
 * ```ts
 * const t = createTrigger<Schema>()
 *   .id('inbox')
 *   .events(['new-message'])
 *   .conditions({ user: null, settings: null })
 *   .require('user', 'settings')
 *   .handle(({ event, conditions, actions }) => {
 *     // conditions.user: User; conditions.settings: Settings
 *   });
 * ```
 */
export function createTrigger<S extends TriggerSchema>(): TriggerBuilder<S>;
export function createTrigger<S extends TriggerSchema>(
  config: CreateTriggerConfig<S>,
  runtime?: Runtime,
): Trigger<S>;
export function createTrigger<S extends TriggerSchema>(
  config?: CreateTriggerConfig<S>,
  runtime?: Runtime,
): Trigger<S> | TriggerBuilder<S> {
  if (config === undefined) return createBuilder<S>();
  return createTriggerFromConfig<S>(config, runtime ?? getDefaultRuntime());
}

function createBuilder<S extends TriggerSchema>(
  initial?: Partial<{
    id: string;
    events: readonly EventKey<S>[];
    required: readonly ConditionKey<S>[];
    conditions: { readonly [K in ConditionKey<S>]?: ConditionMap<S>[K] | null };
    schedule: SchedulerStrategy;
    concurrency: ConcurrencyStrategy;
    scope: string;
    runtime: Runtime;
  }>,
): TriggerBuilder<S> {
  const state = { ...(initial ?? {}) };
  // We return a fresh builder per chained call so the type parameter `R` can
  // narrow correctly; under the hood each call mutates a shared `state` and
  // returns a builder that closes over it. From the type system's POV the
  // returned builder is a new `TriggerBuilder<S, R'>`; at runtime there is
  // exactly one closure per `createTrigger()` chain — keeps allocations down.
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
    handle(handler) {
      if (state.id === undefined) {
        throw new Error('[triggery] createTrigger().handle: .id(...) was not called');
      }
      if (state.events === undefined) {
        throw new Error('[triggery] createTrigger().handle: .events(...) was not called');
      }
      const cfg: CreateTriggerConfig<S> = {
        id: state.id,
        events: state.events,
        handler: handler as TriggerHandler<S, never>,
        ...(state.required !== undefined && { required: state.required }),
        ...(state.conditions !== undefined && { conditions: state.conditions }),
        ...(state.schedule !== undefined && { schedule: state.schedule }),
        ...(state.concurrency !== undefined && { concurrency: state.concurrency }),
        ...(state.scope !== undefined && { scope: state.scope }),
      };
      return createTriggerFromConfig<S>(cfg, state.runtime ?? getDefaultRuntime());
    },
  };
  return builder;
}

function createTriggerFromConfig<S extends TriggerSchema>(
  config: CreateTriggerConfig<S>,
  runtime: Runtime,
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
            devWarnOnce(
              `action-subscribe-disposed:${config.id}:${name}`,
              `[triggery] trigger.action("${name}").subscribe on disposed trigger "${config.id}" — ignored.`,
            );
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
        devWarnOnce(
          `setCondition-disposed:${config.id}:${String(name)}`,
          `[triggery] trigger.setCondition("${String(name)}") on disposed trigger "${config.id}" — ignored.`,
        );
        return;
      }
      const cell = conditionCells.get(name as string);
      if (!cell) {
        devWarnOnce(
          `setCondition-undeclared:${config.id}:${String(name)}`,
          `[triggery] trigger.setCondition("${String(name)}") — "${String(name)}" was not declared in the conditions config of trigger "${config.id}". Use runtime.registerCondition for externally-sourced conditions.`,
        );
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
        get(_target, prop) {
          throw new Error(
            `[triggery] namedHooks().${String(prop)} requires @triggery/react. ` +
              `Use createNamedHooks(trigger) from '@triggery/react' instead.`,
          );
        },
      });
    },
  };
}
