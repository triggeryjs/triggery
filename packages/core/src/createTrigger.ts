import { getDefaultRuntime } from './runtime.ts';
import type {
  ConditionKey,
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
 * **V1 type limitation:** `required` is enforced at runtime only — it does not narrow
 * the types of `conditions.*` inside the handler. Every condition is `T | undefined` in
 * the handler (even when listed in `required`). Use an early return:
 * `if (!conditions.user) return;` — TS narrows `conditions.user` to `User` after that.
 *
 * Alternative: `check.is('user', (u) => u.isActive)` — typesafe predicate with NonNullable narrowing.
 *
 * **V1.1+** will introduce a builder API (`createTrigger<S>().require(['user']).handle(...)`)
 * that automatically narrows required conditions.
 */
export type CreateTriggerConfig<S extends TriggerSchema> = {
  readonly id: string;
  readonly events: readonly EventKey<S>[];
  /** Required condition keys. The trigger will not run unless all of them are registered. */
  readonly required?: readonly ConditionKey<S>[];
  readonly schedule?: SchedulerStrategy;
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
 *   conditions: { user: { id: string }; settings: { sound: boolean } };
 *   actions: { showToast: { title: string }; playSound: void };
 * }>({
 *   id: 'message-received',
 *   events: ['new-message'],
 *   required: ['user', 'settings'],
 *   handler({ event, conditions, actions, check }) {
 *     if (!conditions.user || !conditions.settings) return; // V1: manual narrowing
 *     if (check.is('settings', (s) => s.sound)) actions.playSound?.();
 *     actions.showToast?.({ title: event.payload.author });
 *   },
 * });
 * ```
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
    required: (config.required ?? []) as readonly string[],
    events: config.events as readonly string[],
    handler: internalHandler,
  };

  const token = runtime.registerTrigger(internalConfig);

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
    inspect() {
      return runtime.getTrigger(config.id)?.inspect();
    },
    dispose() {
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
