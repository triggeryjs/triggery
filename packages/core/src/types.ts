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

export type RuntimeOptions = {
  /** Global middleware applied to every trigger in this runtime. */
  middleware?: readonly Middleware[];
  /** Maximum cascade depth (action → fireEvent → ...). Default: 3. */
  maxCascadeDepth?: number;
  /** Inspector ring buffer size (default: 50). */
  inspectorBufferSize?: number;
};

export type FireContext = {
  readonly eventName: string;
  readonly payload: unknown;
  readonly cascadeDepth: number;
  readonly parentRunId?: string;
  readonly parentTriggerId?: string;
  /**
   * Set of trigger ids already visited in the current cascade chain.
   * Used by the dispatcher to detect cycles (a trigger re-entering itself).
   */
  readonly visitedChain?: ReadonlySet<string>;
};

export type SkipContext = {
  readonly triggerId: string;
  readonly eventName: string;
  readonly reason: string;
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
  onSkip?(ctx: SkipContext): void;
  onActionStart?(ctx: ActionContext): void;
  onActionEnd?(ctx: ActionContext & { durationMs: number; result?: unknown }): void;
  onError?(ctx: ActionContext & { error: unknown }): void;
  onCascade?(ctx: CascadeContext): void;
};

export type Runtime = {
  readonly id: string;

  /** Register a trigger. Returns a token for later disposal. */
  registerTrigger(config: InternalTriggerConfig): RegistrationToken;

  /** Register a condition getter for a trigger. */
  registerCondition(triggerId: string, name: string, getter: ConditionGetter): RegistrationToken;

  /** Register an action handler for a trigger. */
  registerAction(triggerId: string, name: string, handler: UntypedActionFn): RegistrationToken;

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
