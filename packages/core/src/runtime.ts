import { chainHas, getCurrentDispatch } from './cascadeContext.ts';
import {
  cancelAllTimers,
  executeTrigger,
  needsTiming,
  type RegisteredTrigger,
} from './dispatch.ts';
import { createInspector, createNoopInspector } from './inspector.ts';
import { createScheduler } from './scheduler.ts';
import type {
  CascadeContext,
  ConditionGetter,
  FireContext,
  InspectorOption,
  InternalTriggerConfig,
  RegisterScopeOptions,
  RegistrationToken,
  Runtime,
  RuntimeGraph,
  RuntimeOptions,
  Trigger,
  TriggerGraphNode,
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

/**
 * Resolve the inspector option against the current environment.
 *
 *   undefined         → DEV on, PROD off (auto)
 *   true              → always on
 *   false             → always off
 *   { dev?, prod? }   → per-env override, unset fields fall back to auto
 *   InspectorFactory  → always on, factory supplies the implementation
 */
function resolveInspectorEnabled(option: InspectorOption | undefined): boolean {
  if (option === true) return true;
  if (option === false) return false;
  if (typeof option === 'function') return true;
  const dev = isDev();
  if (option === undefined) return dev;
  // Object form: explicit overrides per environment, with auto fallback.
  if (dev) return option.dev ?? true;
  return option.prod ?? false;
}

export function createRuntime(options: RuntimeOptions = {}): Runtime {
  const id = genRuntimeId();
  const triggers = new Map<string, RegisteredTrigger>();
  const eventIndex = new Map<string, Set<RegisteredTrigger>>();
  const middleware = options.middleware ?? [];
  // Cached at construction — middleware is immutable for the runtime's lifetime,
  // so we avoid recomputing these flags on the dispatch hot path.
  const hasMiddleware = middleware.length > 0;
  const trackTiming = needsTiming(middleware);
  const maxCascadeDepth = options.maxCascadeDepth ?? 3;
  const inspectorEnabled = resolveInspectorEnabled(options.inspector);
  const inspectorBufferSize = options.inspectorBufferSize ?? 50;
  const inspector = inspectorEnabled
    ? typeof options.inspector === 'function'
      ? options.inspector(inspectorBufferSize)
      : createInspector(inspectorBufferSize)
    : createNoopInspector();
  const microtaskScheduler = createScheduler('microtask');
  const syncScheduler = createScheduler('sync');

  /**
   * DEV-only memo of `(label:triggerId:name)` keys we've already warned about,
   * so the user sees one warning per collision rather than one per re-render.
   * StrictMode's mount → unmount → mount cycle empties the stack before the
   * second mount, so it doesn't trigger this warning.
   */
  const warnedCollisions = new Set<string>();

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
        cancelAllTimers(existing);
        for (const prev of existing.inFlight) prev.abort('trigger-replaced');
        existing.inFlight.clear();
      }
    }
    const registered: RegisteredTrigger = {
      config,
      conditions: new Map(),
      actions: new Map(),
      conditionStacks: new Map(),
      actionStacks: new Map(),
      channelSubscribers: new Map(),
      enabled: true,
      inFlight: new Set(),
      queueTail: Promise.resolve(),
      timers: new Map(),
      deferCounter: 0,
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
        cancelAllTimers(registered);
        for (const ctl of registered.inFlight) ctl.abort('trigger-disposed');
        registered.inFlight.clear();
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
    scope: string,
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
    // Scope-match gate. A trigger declared with `scope: 'chat'` only sees
    // registrations made in scope `'chat'`; a global trigger (no scope) only
    // sees global registrations. Mismatches are silent no-ops at runtime, but
    // we warn-once in DEV so the user notices the wiring is off.
    if (trigger.config.scope !== scope) {
      if (isDev()) {
        const collisionKey = `scope-mismatch:${label}:${triggerId}:${scope}:${name}`;
        if (!warnedCollisions.has(collisionKey)) {
          warnedCollisions.add(collisionKey);
          // eslint-disable-next-line no-console -- DEV warn
          console.warn(
            `[triggery] register${label === 'condition' ? 'Condition' : 'Action'}: scope mismatch — ` +
              `trigger "${triggerId}" has scope "${trigger.config.scope || '(global)'}" but the ` +
              `registration came from scope "${scope || '(global)'}". The registration is ignored.`,
          );
        }
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

    // DEV: warn-once per (label, triggerId, name) when a second live
    // registration arrives. Helps catch accidental multi-provider setups
    // ("why does the trigger see value B, not A?") without spamming the
    // console on every re-render or on StrictMode's mount-cycle.
    if (isDev() && stack.length > 0) {
      const collisionKey = `${label}:${triggerId}:${name}`;
      if (!warnedCollisions.has(collisionKey)) {
        warnedCollisions.add(collisionKey);
        // eslint-disable-next-line no-console -- DEV warn
        console.warn(
          `[triggery] multiple ${label} registrations for "${name}" on trigger "${triggerId}" — last-mount-wins. ` +
            'To compose values from several sources, register through a single hook.',
        );
      }
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
    options?: RegisterScopeOptions,
  ): RegistrationToken =>
    registerStacked(triggerId, name, getter, 'condition', options?.scope ?? '');

  const registerAction = (
    triggerId: string,
    name: string,
    handler: UntypedActionFn,
    options?: RegisterScopeOptions,
  ): RegistrationToken => registerStacked(triggerId, name, handler, 'action', options?.scope ?? '');

  /**
   * Additive (non-last-mount-wins) subscription to an action — used by the
   * v0.10 action-channel API (`trigger.action(name).subscribe(cb)`). Every
   * subscriber is invoked on every action emit, in addition to the
   * top-of-stack handler registered via `registerAction`. Returns an
   * idempotent token that removes the subscriber.
   *
   * Scope semantics mirror `registerAction`: a scope-mismatched call is a
   * silent no-op (with a DEV warn-once) and returns a noop token.
   */
  const subscribeAction = (
    triggerId: string,
    name: string,
    cb: UntypedActionFn,
    options?: RegisterScopeOptions,
  ): RegistrationToken => {
    const scope = options?.scope ?? '';
    const trigger = triggers.get(triggerId);
    if (!trigger) {
      if (isDev()) {
        // eslint-disable-next-line no-console -- DEV warn
        console.warn(`[triggery] subscribeAction: trigger "${triggerId}" not found`);
      }
      return { unregister() {} };
    }
    if (trigger.config.scope !== scope) {
      if (isDev()) {
        const collisionKey = `scope-mismatch:action-channel:${triggerId}:${scope}:${name}`;
        if (!warnedCollisions.has(collisionKey)) {
          warnedCollisions.add(collisionKey);
          // eslint-disable-next-line no-console -- DEV warn
          console.warn(
            `[triggery] subscribeAction: scope mismatch — trigger "${triggerId}" has scope ` +
              `"${trigger.config.scope || '(global)'}" but the subscribe call came from scope ` +
              `"${scope || '(global)'}". The subscription is ignored.`,
          );
        }
      }
      return { unregister() {} };
    }
    let set = trigger.channelSubscribers.get(name);
    if (!set) {
      set = new Set();
      trigger.channelSubscribers.set(name, set);
    }
    set.add(cb);
    let unregistered = false;
    return {
      unregister() {
        if (unregistered) return;
        unregistered = true;
        const live = triggers.get(triggerId);
        if (!live) return;
        const liveSet = live.channelSubscribers.get(name);
        if (!liveSet) return;
        liveSet.delete(cb);
        if (liveSet.size === 0) live.channelSubscribers.delete(name);
      },
    };
  };

  // ─── cascade helpers ──────────────────────────────────────────────────
  const emitCascade = (info: CascadeContext) => {
    for (const mw of middleware) mw.onCascade?.(info);
  };

  /**
   * Build a FireContext, taking the current synchronous dispatch context into
   * account (so an action emitting a new event is tagged as a cascade rather
   * than as a top-level fire).
   *
   * Top-level fires leave `parentContext` undefined — keeps the empty-registry
   * hot path allocation-free. Cascade fires carry a linked-list reference to
   * the parent dispatch so the cycle check can walk the chain.
   */
  const buildFireContext = (eventName: string, payload: unknown): FireContext => {
    const parent = getCurrentDispatch();
    if (parent && parent.runtimeId === id) {
      return {
        eventName,
        payload,
        cascadeDepth: parent.cascadeDepth + 1,
        parentRunId: parent.runId,
        parentTriggerId: parent.triggerId,
        parentContext: parent,
      };
    }
    return { eventName, payload, cascadeDepth: 0 };
  };

  // ─── dispatch ──────────────────────────────────────────────────────────
  type DispatchOpts = { forceSync: boolean };

  const dispatch = (fireCtx: FireContext, opts: DispatchOpts) => {
    // Middleware onFire — gated by `hasMiddleware` so the empty-middleware path
    // skips even the for-of setup.
    if (hasMiddleware) {
      for (const mw of middleware) {
        const result = mw.onFire?.(fireCtx);
        if (result?.cancel) return;
      }
    }

    // Cascade depth gate. Top-level fires have depth=0, so this can only
    // trigger when a cascade has produced FireContext.cascadeDepth > max.
    if (fireCtx.cascadeDepth > maxCascadeDepth) {
      emitCascade({
        parentTriggerId: fireCtx.parentTriggerId ?? '',
        parentRunId: fireCtx.parentRunId ?? '',
        newEventName: fireCtx.eventName,
        cascadeDepth: fireCtx.cascadeDepth,
        kind: 'overflow',
      });
      return;
    }

    const set = eventIndex.get(fireCtx.eventName);
    if (!set || set.size === 0) return;

    // Snapshot the matching triggers at fire-time (registry changes during the
    // handler don't affect this run). For the common single-subscriber case we
    // skip the array allocation entirely.
    const triggersForEvent: readonly RegisteredTrigger[] =
      set.size === 1 ? [set.values().next().value as RegisteredTrigger] : Array.from(set);
    const parentCtx = fireCtx.parentContext;
    for (const trigger of triggersForEvent) {
      if (!trigger.enabled) continue;

      // Cycle detection: walk the parent chain looking for this trigger's id.
      // O(cascade-depth); cascade max is 3 by default so this is effectively O(1).
      if (parentCtx !== undefined && chainHas(parentCtx as never, trigger.config.id)) {
        emitCascade({
          parentTriggerId: fireCtx.parentTriggerId ?? '',
          parentRunId: fireCtx.parentRunId ?? '',
          newEventName: fireCtx.eventName,
          cascadeDepth: fireCtx.cascadeDepth,
          kind: 'cycle',
        });
        continue;
      }

      const run = () => {
        executeTrigger({
          trigger,
          fireCtx,
          inspector,
          inspectorEnabled,
          middleware,
          hasMiddleware,
          trackTiming,
          runtimeId: id,
        });
      };

      // `forceSync` skips the per-trigger scheduler choice (used by fireSync).
      if (opts.forceSync) {
        run();
        continue;
      }
      const scheduler = trigger.config.schedule === 'sync' ? syncScheduler : microtaskScheduler;
      scheduler.enqueue(run);
    }
  };

  const fire = (eventName: string, payload?: unknown): void => {
    dispatch(buildFireContext(eventName, payload), { forceSync: false });
  };

  const fireSync = (eventName: string, payload?: unknown): void => {
    dispatch(buildFireContext(eventName, payload), { forceSync: true });
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

  const graph = (): RuntimeGraph => {
    const nodes: TriggerGraphNode[] = [];
    for (const t of triggers.values()) {
      nodes.push({
        id: t.config.id,
        scope: t.config.scope,
        events: t.config.events,
        required: t.config.required,
        schedule: t.config.schedule,
        concurrency: t.config.concurrency,
        enabled: t.enabled,
      });
    }
    const idx: Record<string, string[]> = {};
    for (const [eventName, triggerSet] of eventIndex) {
      idx[eventName] = Array.from(triggerSet).map((t) => t.config.id);
    }
    return { triggers: nodes, eventIndex: idx };
  };

  const dispose = () => {
    for (const trigger of triggers.values()) {
      for (const ctl of trigger.inFlight) ctl.abort('runtime-disposed');
      trigger.inFlight.clear();
      cancelAllTimers(trigger);
      trigger.enabled = false;
    }
    triggers.clear();
    eventIndex.clear();
    inspector.clear();
  };

  return {
    id,
    inspectorEnabled,
    registerTrigger,
    registerCondition,
    registerAction,
    subscribeAction,
    fire,
    fireSync,
    subscribe,
    getInspectorBuffer,
    getTrigger,
    graph,
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
    setCondition() {
      throw new Error(
        '[triggery] setCondition() can only be called on the original trigger object (returned by createTrigger)',
      );
    },
    action() {
      throw new Error(
        '[triggery] action() can only be called on the original trigger object (returned by createTrigger)',
      );
    },
    namedHooks() {
      throw new Error('[triggery] namedHooks() can only be called on the original trigger object');
    },
    inspect() {
      return inspector.getLastForTrigger(internal.config.id);
    },
    dispose() {
      internal.enabled = false;
      for (const ctl of internal.inFlight) ctl.abort('disposed');
      internal.inFlight.clear();
      cancelAllTimers(internal);
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
