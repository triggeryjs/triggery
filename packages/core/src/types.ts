/**
 * Public types of Triggery Core.
 *
 * Convention:
 *   `S` — trigger schema (`TriggerSchema`).
 *   `R` — tuple/union of required condition keys (`required`).
 */

/** Fallback "empty map" type used when part of the schema is omitted. */
export type EmptyRecord = Record<string, never>;

export type TriggerSchema = {
  events?: Record<string, unknown>;
  conditions?: Record<string, unknown>;
  actions?: Record<string, unknown>;
};

export type EventMap<S extends TriggerSchema> =
  S['events'] extends Record<string, unknown> ? S['events'] : EmptyRecord;
export type ConditionMap<S extends TriggerSchema> =
  S['conditions'] extends Record<string, unknown> ? S['conditions'] : EmptyRecord;
export type ActionMap<S extends TriggerSchema> =
  S['actions'] extends Record<string, unknown> ? S['actions'] : EmptyRecord;

export type EventKey<S extends TriggerSchema> = Extract<keyof EventMap<S>, string>;
export type ConditionKey<S extends TriggerSchema> = Extract<keyof ConditionMap<S>, string>;
export type ActionKey<S extends TriggerSchema> = Extract<keyof ActionMap<S>, string>;

/**
 * Discriminated union over all events in the schema.
 * Used in `TriggerCtx.event` — handlers can branch on `event.name`.
 */
export type EventOf<S extends TriggerSchema> = {
  [K in EventKey<S>]: { readonly name: K; readonly payload: EventMap<S>[K] };
}[EventKey<S>];

/**
 * Conditions: required keys are non-optional, the rest are optional.
 */
export type ConditionsCtx<C extends Record<string, unknown>, R extends keyof C = never> = {
  readonly [K in R]: C[K];
} & {
  readonly [K in Exclude<keyof C, R>]?: C[K];
};

export type ActionFn<P> = [P] extends [void] ? () => void : (payload: P) => void;

/**
 * Actions: all entries are optional (they may not be registered) plus
 * chainable `debounce/throttle/defer` (V1: stubs, full implementation in V1.1+).
 */
export type ActionsCtx<A extends Record<string, unknown>> = {
  readonly [K in keyof A]?: ActionFn<A[K]>;
} & {
  debounce(ms: number): ActionsCtx<A>;
  throttle(ms: number): ActionsCtx<A>;
  defer(ms: number): ActionsCtx<A>;
};

/**
 * `check` helpers — DSL for condition checks inside a handler.
 *   - `is(key, predicate)` — true when the condition exists and the predicate matches.
 *   - `all({ key: predicate, ... })` — every listed condition must exist and match.
 *   - `any({ key: predicate, ... })` — at least one must match.
 */
export type CheckCtx<C extends Record<string, unknown>> = {
  is<K extends keyof C>(key: K, predicate: (value: NonNullable<C[K]>) => boolean): boolean;
  all<M extends Partial<{ [K in keyof C]: (value: NonNullable<C[K]>) => boolean }>>(
    map: M,
  ): boolean;
  any<M extends Partial<{ [K in keyof C]: (value: NonNullable<C[K]>) => boolean }>>(
    map: M,
  ): boolean;
};

/**
 * `meta` — runtime metadata about the current run (runId, parentRunId for cascade, etc.).
 */
export type MetaCtx = {
  readonly runId: string;
  readonly triggerId: string;
  readonly scheduledAt: number;
  readonly cascadeDepth: number;
  readonly parentRunId?: string;
  readonly parentTriggerId?: string;
};

/**
 * The context object passed to a handler on every run.
 */
export type TriggerCtx<S extends TriggerSchema, R extends ConditionKey<S> = never> = {
  readonly event: EventOf<S>;
  readonly conditions: ConditionsCtx<ConditionMap<S>, R>;
  readonly actions: ActionsCtx<ActionMap<S>>;
  readonly check: CheckCtx<ConditionMap<S>>;
  readonly meta: MetaCtx;
  readonly signal: AbortSignal;
};

export type TriggerHandler<S extends TriggerSchema, R extends ConditionKey<S> = never> = (
  ctx: TriggerCtx<S, R>,
) => void | Promise<void>;

export type SchedulerStrategy = 'sync' | 'microtask';

export type ConcurrencyStrategy =
  | 'sync'
  | 'take-latest'
  | 'take-every'
  | 'take-first'
  | 'queue'
  | 'exhaust';

export type TriggerConfig<S extends TriggerSchema, R extends ConditionKey<S> = never> = {
  /** Unique trigger id within a runtime. */
  id: string;
  /** Required condition keys. The handler will not run unless all of them are registered. */
  required?: readonly R[];
  /** Dispatch scheduling strategy (default: `'microtask'`). */
  schedule?: SchedulerStrategy;
  /** Default concurrency for async actions inside the handler. */
  concurrency?: ConcurrencyStrategy;
  /** Scope id (for `<TriggerScope>` isolation; ignored in V1). */
  scope?: string;
  /** Trigger body. */
  handler: TriggerHandler<S, R>;
};

/**
 * Capitalize the first character of a string. Used to build named hook identifiers.
 * @internal
 */
type CapFirst<S extends string> = S extends `${infer A}${infer B}` ? `${Uppercase<A>}${B}` : S;

/**
 * Convert a kebab-case key to camelCase: `'new-message'` → `'newMessage'`.
 * @internal
 */
type KebabToCamel<S extends string> = S extends `${infer A}-${infer B}`
  ? `${A}${CapFirst<KebabToCamel<B>>}`
  : S;

/** kebab-case or camelCase → PascalCase, for substitution into `use<Name>...`. */
export type ToPascal<S extends string> = CapFirst<KebabToCamel<S>>;

/**
 * Event hook signature — returns an emitter with a correctly typed payload.
 */
export type EventHook<P> = () => [P] extends [void] ? () => void : (payload: P) => void;

/**
 * Condition hook signature.
 */
export type ConditionHook<V> = (
  getter: () => V,
  deps?: readonly unknown[],
  options?: { readonly subscribe?: boolean },
) => void;

/**
 * Action hook signature — registers an executor.
 */
export type ActionHook<P> = (
  handler: [P] extends [void] ? () => void : (payload: P) => void,
) => void;

/**
 * Generated named hooks. Returned by `trigger.namedHooks()`.
 */
export type NamedHooks<S extends TriggerSchema> = {
  readonly [K in EventKey<S> as `use${ToPascal<K>}Event`]: EventHook<EventMap<S>[K]>;
} & {
  readonly [K in ConditionKey<S> as `use${ToPascal<K>}Condition`]: ConditionHook<
    ConditionMap<S>[K]
  >;
} & {
  readonly [K in ActionKey<S> as `use${ToPascal<K>}Action`]: ActionHook<ActionMap<S>[K]>;
};

/**
 * The public trigger object returned by `createTrigger`.
 */
export type Trigger<S extends TriggerSchema> = {
  readonly id: string;
  readonly schedule: SchedulerStrategy;
  /** Enable / disable the trigger at runtime. */
  enable(): void;
  disable(): void;
  isEnabled(): boolean;
  /** Get the named hooks proxy (typed via template literal types). */
  namedHooks(): NamedHooks<S>;
  /** Snapshot of the most recent run (for devtools / `useInspect`). */
  inspect(): TriggerInspectSnapshot | undefined;
  /** Remove the trigger from its runtime permanently. */
  dispose(): void;
};

export type TriggerInspectSnapshot = {
  readonly triggerId: string;
  readonly runId: string;
  readonly eventName: string;
  readonly status: 'fired' | 'skipped' | 'errored' | 'aborted';
  readonly reason?: string;
  readonly durationMs: number;
  readonly executedActions: readonly string[];
  readonly snapshotKeys: readonly string[];
};

// ──────────────────────────────────────────────────────────────────────────────
// Runtime types (internal public API shared between core and bindings)
// ──────────────────────────────────────────────────────────────────────────────

export type ConditionGetter<V = unknown> = () => V;
export type UntypedActionFn = (payload: unknown) => void | Promise<void>;

export type RegistrationToken = {
  /** Idempotent unregister. */
  unregister(): void;
};

/**
 * Per-environment override for the inspector flag. Either field may be omitted,
 * in which case the auto default applies (DEV on, PROD off).
 */
export type InspectorEnvOverride = {
  readonly dev?: boolean;
  readonly prod?: boolean;
};

/**
 * Inspector configuration for `createRuntime`.
 *
 * - `undefined` (default) — auto: on in DEV (`process.env.NODE_ENV !== 'production'`), off in PROD.
 * - `true` — always on regardless of env.
 * - `false` — always off regardless of env.
 * - `{ dev?, prod? }` — per-env override; unset fields fall back to the auto default.
 *
 * When off, the runtime skips the per-run buffer write, `subscribe()` callbacks
 * never fire, `getInspectorBuffer()` returns `[]`, and the hot path drops the
 * snapshot allocation entirely (~30-40% extra throughput on a simple dispatch).
 * Devtools — `@triggery/devtools-redux`, `@triggery/devtools-bridge`, the React
 * `useInspectHistory` hook — require the inspector to be on.
 */
export type InspectorOption = boolean | InspectorEnvOverride;

export type RuntimeOptions = {
  /** Global middleware applied to every trigger in this runtime. */
  middleware?: readonly Middleware[];
  /** Maximum cascade depth (action → fireEvent → ...). Default: 3. */
  maxCascadeDepth?: number;
  /** Inspector ring buffer size (default: 50). Ignored when the inspector is disabled. */
  inspectorBufferSize?: number;
  /** Enable / disable the per-run inspector. See {@link InspectorOption}. */
  inspector?: InspectorOption;
};

export type FireContext = {
  readonly eventName: string;
  readonly payload: unknown;
  readonly cascadeDepth: number;
  readonly parentRunId?: string;
  readonly parentTriggerId?: string;
  /**
   * Linked-list reference to the parent dispatch context (the trigger
   * currently running whose handler/action called this `fire`). The
   * dispatcher walks this chain to detect cycles without ever allocating a
   * `Set` of visited ids on the hot path. `undefined` on top-level fires.
   *
   * The full `DispatchContext` shape is internal — middleware should treat
   * this field as opaque.
   */
  readonly parentContext?: { readonly triggerId: string; readonly parent: unknown } | undefined;
};

export type SkipContext = {
  readonly triggerId: string;
  readonly eventName: string;
  readonly reason: string;
};

export type MatchContext = {
  readonly triggerId: string;
  readonly eventName: string;
  readonly payload: unknown;
  readonly cascadeDepth: number;
};

export type ActionContext = {
  readonly triggerId: string;
  readonly runId: string;
  readonly actionName: string;
  readonly payload: unknown;
};

export type CascadeContext = {
  readonly parentTriggerId: string;
  readonly parentRunId: string;
  readonly newEventName: string;
  readonly cascadeDepth: number;
  readonly kind: 'overflow' | 'cycle';
};

export type Middleware = {
  readonly name: string;
  onFire?(ctx: FireContext): void | { cancel: true; reason: string };
  /**
   * Called once per (event, trigger) pair right after dispatch picks the
   * trigger out of `eventIndex[eventName]`, before any concurrency gate /
   * required-check / handler invocation. Useful for tracing "which triggers
   * were considered for this event" without instrumenting `onSkip` and
   * `onActionStart` separately. Purely observational — there is no `cancel`
   * here, use `onFire` if you need to short-circuit a fire entirely.
   */
  onBeforeMatch?(ctx: MatchContext): void;
  onSkip?(ctx: SkipContext): void;
  onActionStart?(ctx: ActionContext): void;
  onActionEnd?(ctx: ActionContext & { durationMs: number; result?: unknown }): void;
  onError?(ctx: ActionContext & { error: unknown }): void;
  onCascade?(ctx: CascadeContext): void;
};

/**
 * Optional scoping for `registerCondition` / `registerAction`. A scope is just
 * a string id — registrations live in their own bucket per scope. A trigger
 * whose `scope` matches receives that bucket; triggers without scope see the
 * global bucket (scope `''`).
 *
 * @see `<TriggerScope id="…">` in `@triggery/react`.
 */
export type RegisterScopeOptions = {
  readonly scope?: string;
};

/**
 * Static, serializable description of a trigger — used by `runtime.graph()`,
 * devtools panels, the CLI and any code that wants to introspect the registry
 * without holding a reference to the live runtime objects.
 */
export type TriggerGraphNode = {
  readonly id: string;
  readonly scope: string;
  readonly events: readonly string[];
  readonly required: readonly string[];
  readonly schedule: SchedulerStrategy;
  readonly concurrency: ConcurrencyStrategy;
  readonly enabled: boolean;
};

/**
 * JSON-friendly snapshot of the runtime's trigger registry. Stable shape —
 * safe to log, send over a postMessage bridge, or render in devtools.
 */
export type RuntimeGraph = {
  readonly triggers: readonly TriggerGraphNode[];
  /** Map of `eventName → triggerId[]`. Empty events are not included. */
  readonly eventIndex: Readonly<Record<string, readonly string[]>>;
};

export type Runtime = {
  readonly id: string;

  /**
   * Whether the per-run inspector is active on this runtime. Devtools bridges
   * can use this to detect "you mounted me but the runtime won't emit anything"
   * and surface a one-time DEV warning.
   */
  readonly inspectorEnabled: boolean;

  /** Register a trigger. Returns a token for later disposal. */
  registerTrigger(config: InternalTriggerConfig): RegistrationToken;

  /** Register a condition getter for a trigger. */
  registerCondition(
    triggerId: string,
    name: string,
    getter: ConditionGetter,
    options?: RegisterScopeOptions,
  ): RegistrationToken;

  /** Register an action handler for a trigger. */
  registerAction(
    triggerId: string,
    name: string,
    handler: UntypedActionFn,
    options?: RegisterScopeOptions,
  ): RegistrationToken;

  /** Fire an event asynchronously (through the scheduler). */
  fire(eventName: string, payload?: unknown): void;

  /** Run dispatch synchronously (for tests and benchmarks). */
  fireSync(eventName: string, payload?: unknown): void;

  /** Subscribe to all runtime events (read-only). */
  subscribe(listener: (snapshot: TriggerInspectSnapshot) => void): RegistrationToken;

  /** Get the most recent N runs (newest first). */
  getInspectorBuffer(): readonly TriggerInspectSnapshot[];

  /** Look up a trigger by id (for `useInspect` and CLI tools). */
  getTrigger(triggerId: string): Trigger<TriggerSchema> | undefined;

  /**
   * JSON-friendly snapshot of the trigger registry — for devtools, the CLI's
   * `triggery graph` command, and tooling that introspects connections.
   */
  graph(): RuntimeGraph;

  /** Tear down the runtime completely. */
  dispose(): void;
};

/** Internal (non-public for end users) shape consumed by the runtime. */
export type InternalTriggerConfig = {
  readonly id: string;
  readonly schedule: SchedulerStrategy;
  readonly concurrency: ConcurrencyStrategy;
  readonly required: readonly string[];
  readonly events: readonly string[];
  /** Scope key — `undefined`/`''` means global. See `RegisterScopeOptions`. */
  readonly scope: string;
  readonly handler: (ctx: InternalHandlerCtx) => void | Promise<void>;
};

export type InternalHandlerCtx = {
  readonly event: { readonly name: string; readonly payload: unknown };
  readonly conditions: Record<string, unknown>;
  readonly actions: Record<string, ((payload: unknown) => void) | undefined> & {
    debounce(ms: number): InternalHandlerCtx['actions'];
    throttle(ms: number): InternalHandlerCtx['actions'];
    defer(ms: number): InternalHandlerCtx['actions'];
  };
  readonly check: CheckCtx<Record<string, unknown>>;
  readonly meta: MetaCtx;
  readonly signal: AbortSignal;
};
