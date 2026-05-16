import { executeTrigger, type RegisteredTrigger } from './dispatch.ts';
import { createInspector } from './inspector.ts';
import { createScheduler } from './scheduler.ts';
import type {
  ConditionGetter,
  FireContext,
  InternalTriggerConfig,
  RegistrationToken,
  Runtime,
  RuntimeOptions,
  Trigger,
  TriggerInspectSnapshot,
  TriggerSchema,
  UntypedActionFn,
} from './types.ts';

let runtimeIdCounter = 0;
const genRuntimeId = () => `runtime_${(++runtimeIdCounter).toString(36)}`;

/** Browser-safe DEV-mode detector. */
const isDev = (): boolean => {
  const env = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV;
  return env !== 'production';
};

export function createRuntime(options: RuntimeOptions = {}): Runtime {
  const id = genRuntimeId();
  const triggers = new Map<string, RegisteredTrigger>();
  const eventIndex = new Map<string, Set<RegisteredTrigger>>();
  const middleware = options.middleware ?? [];
  const maxCascadeDepth = options.maxCascadeDepth ?? 3;
  const inspector = createInspector(options.inspectorBufferSize ?? 50);
  const microtaskScheduler = createScheduler('microtask');
  const syncScheduler = createScheduler('sync');

  const indexEvent = (eventName: string, trigger: RegisteredTrigger) => {
    let set = eventIndex.get(eventName);
    if (!set) {
      set = new Set();
      eventIndex.set(eventName, set);
    }
    set.add(trigger);
  };

  const deindexEvent = (eventName: string, trigger: RegisteredTrigger) => {
    const set = eventIndex.get(eventName);
    if (!set) return;
    set.delete(trigger);
    if (set.size === 0) eventIndex.delete(eventName);
  };

  // ─── triggers ──────────────────────────────────────────────────────────
  const registerTrigger = (config: InternalTriggerConfig): RegistrationToken => {
    if (triggers.has(config.id)) {
      // last-mount-wins: silently replace (warn-once is handled by the React bindings).
      const existing = triggers.get(config.id);
      if (existing) {
        for (const eventName of existing.config.events) deindexEvent(eventName, existing);
      }
    }
    const registered: RegisteredTrigger = {
      config,
      conditions: new Map(),
      actions: new Map(),
      conditionStacks: new Map(),
      actionStacks: new Map(),
      enabled: true,
      inFlight: undefined,
    };
    triggers.set(config.id, registered);
    for (const eventName of config.events) indexEvent(eventName, registered);

    let unregistered = false;
    return {
      unregister() {
        if (unregistered) return;
        unregistered = true;
        const current = triggers.get(config.id);
        if (current !== registered) return;
        for (const eventName of registered.config.events) deindexEvent(eventName, registered);
        triggers.delete(config.id);
      },
    };
  };

  // ─── conditions / actions ─────────────────────────────────────────────
  //
  // Conditions and actions are stored as stacks. The last registration wins
  // (top of stack), so React StrictMode double-mount, multiple providers and
  // overlapping registrations all behave deterministically.
  //
  // The Map<name, fn> on the trigger always mirrors the top of the stack so
  // that `dispatch.ts` stays simple (no stack inspection on the hot path).

  const registerStacked = (
    triggerId: string,
    name: string,
    fn: unknown,
    label: 'condition' | 'action',
  ): RegistrationToken => {
    const trigger = triggers.get(triggerId);
    if (!trigger) {
      if (isDev()) {
        // eslint-disable-next-line no-console -- DEV warn
        console.warn(
          `[triggery] register${label === 'condition' ? 'Condition' : 'Action'}: trigger "${triggerId}" not found`,
        );
      }
      return { unregister() {} };
    }
    const stacks: Map<string, unknown[]> =
      label === 'condition'
        ? (trigger.conditionStacks as unknown as Map<string, unknown[]>)
        : (trigger.actionStacks as unknown as Map<string, unknown[]>);
    const mirror: Map<string, unknown> =
      label === 'condition'
        ? (trigger.conditions as unknown as Map<string, unknown>)
        : (trigger.actions as unknown as Map<string, unknown>);

    let stack = stacks.get(name);
    if (!stack) {
      stack = [];
      stacks.set(name, stack);
    }
    stack.push(fn);
    mirror.set(name, fn);

    let unregistered = false;
    return {
      unregister() {
        if (unregistered) return;
        unregistered = true;
        const t = triggers.get(triggerId);
        if (!t) return;
        const liveStacks: Map<string, unknown[]> =
          label === 'condition'
            ? (t.conditionStacks as unknown as Map<string, unknown[]>)
            : (t.actionStacks as unknown as Map<string, unknown[]>);
        const liveMirror: Map<string, unknown> =
          label === 'condition'
            ? (t.conditions as unknown as Map<string, unknown>)
            : (t.actions as unknown as Map<string, unknown>);
        const liveStack = liveStacks.get(name);
        if (!liveStack) return;
        // Remove the most-recent occurrence of this fn (StrictMode-safe).
        for (let i = liveStack.length - 1; i >= 0; i--) {
          if (liveStack[i] === fn) {
            liveStack.splice(i, 1);
            break;
          }
        }
        if (liveStack.length === 0) {
          liveStacks.delete(name);
          liveMirror.delete(name);
        } else {
          liveMirror.set(name, liveStack[liveStack.length - 1]);
        }
      },
    };
  };

  const registerCondition = (
    triggerId: string,
    name: string,
    getter: ConditionGetter,
  ): RegistrationToken => registerStacked(triggerId, name, getter, 'condition');

  const registerAction = (
    triggerId: string,
    name: string,
    handler: UntypedActionFn,
  ): RegistrationToken => registerStacked(triggerId, name, handler, 'action');

  // ─── dispatch ──────────────────────────────────────────────────────────
  const dispatch = (fireCtx: FireContext) => {
    // Middleware onFire
    for (const mw of middleware) {
      const result = mw.onFire?.(fireCtx);
      if (result?.cancel) return;
    }

    const set = eventIndex.get(fireCtx.eventName);
    if (!set || set.size === 0) return;

    // Snapshot the matching triggers at fire-time (registry changes during the handler don't affect this run).
    const triggersForEvent = Array.from(set);
    for (const trigger of triggersForEvent) {
      if (!trigger.enabled) continue;
      const schedulerForTrigger =
        trigger.config.schedule === 'sync' ? syncScheduler : microtaskScheduler;
      schedulerForTrigger.enqueue(() => {
        executeTrigger({
          trigger,
          fireCtx,
          inspector,
          middleware,
          cascadeFire: (eventName, payload, parentRunId) => {
            const nextDepth = fireCtx.cascadeDepth + 1;
            if (nextDepth > maxCascadeDepth) {
              for (const mw of middleware) {
                mw.onCascade?.({
                  parentTriggerId: trigger.config.id,
                  parentRunId,
                  newEventName: eventName,
                  cascadeDepth: nextDepth,
                  kind: 'overflow',
                });
              }
              return;
            }
            dispatch({
              eventName,
              payload,
              cascadeDepth: nextDepth,
              parentRunId,
            });
          },
        });
      });
    }
  };

  const fire = (eventName: string, payload?: unknown): void => {
    dispatch({ eventName, payload, cascadeDepth: 0 });
  };

  const fireSync = (eventName: string, payload?: unknown): void => {
    // Force-sync — ignore per-trigger schedule.
    for (const mw of middleware) {
      const result = mw.onFire?.({ eventName, payload, cascadeDepth: 0 });
      if (result?.cancel) return;
    }
    const set = eventIndex.get(eventName);
    if (!set || set.size === 0) return;
    const triggersForEvent = Array.from(set);
    for (const trigger of triggersForEvent) {
      if (!trigger.enabled) continue;
      executeTrigger({
        trigger,
        fireCtx: { eventName, payload, cascadeDepth: 0 },
        inspector,
        middleware,
        cascadeFire: () => {
          // sync mode: cascades would also run sync, dispatched via the regular path with depth tracking.
        },
      });
    }
  };

  // ─── subscribe / inspector ─────────────────────────────────────────────
  const subscribe = (listener: (snapshot: TriggerInspectSnapshot) => void): RegistrationToken => {
    const off = inspector.subscribe(listener);
    let unregistered = false;
    return {
      unregister() {
        if (unregistered) return;
        unregistered = true;
        off();
      },
    };
  };

  const getInspectorBuffer = () => inspector.getBuffer();

  const getTrigger = (triggerId: string): Trigger<TriggerSchema> | undefined => {
    const trigger = triggers.get(triggerId);
    if (!trigger) return undefined;
    return buildPublicTrigger(trigger, inspector);
  };

  const dispose = () => {
    for (const trigger of triggers.values()) {
      trigger.inFlight?.abort('runtime-disposed');
      trigger.enabled = false;
    }
    triggers.clear();
    eventIndex.clear();
    inspector.clear();
  };

  return {
    id,
    registerTrigger,
    registerCondition,
    registerAction,
    fire,
    fireSync,
    subscribe,
    getInspectorBuffer,
    getTrigger,
    dispose,
  };
}

function buildPublicTrigger(
  internal: RegisteredTrigger,
  inspector: { getLastForTrigger(id: string): TriggerInspectSnapshot | undefined },
): Trigger<TriggerSchema> {
  return {
    id: internal.config.id,
    schedule: internal.config.schedule,
    enable() {
      internal.enabled = true;
    },
    disable() {
      internal.enabled = false;
    },
    isEnabled() {
      return internal.enabled;
    },
    namedHooks() {
      throw new Error('[triggery] namedHooks() can only be called on the original trigger object');
    },
    inspect() {
      return inspector.getLastForTrigger(internal.config.id);
    },
    dispose() {
      internal.enabled = false;
      internal.inFlight?.abort('disposed');
    },
  };
}

// ─── default runtime (lazy) ────────────────────────────────────────────────
let _defaultRuntime: Runtime | undefined;
export function getDefaultRuntime(): Runtime {
  if (!_defaultRuntime) _defaultRuntime = createRuntime();
  return _defaultRuntime;
}
export function setDefaultRuntime(runtime: Runtime): void {
  _defaultRuntime = runtime;
}
