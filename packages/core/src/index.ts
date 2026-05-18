/**
 * @triggery/core — framework-agnostic orchestration runtime. Zero runtime
 * dependencies. Bindings for React, Solid, Vue (and anything else you wire
 * up in ~50 lines) live in their own packages — see the related-packages
 * section in the README.
 *
 * Public entry points:
 *   - `createTrigger<Schema>(config)` — define a trigger.
 *   - `createRuntime(options?)` — create an isolated runtime.
 *   - `getDefaultRuntime()` / `setDefaultRuntime()` — global singleton helpers.
 *   - `createCheck` — DSL for condition checks (wired into the handler context automatically).
 *
 * Minimal example (no React):
 *
 *   const runtime = createRuntime();
 *   createTrigger<{
 *     events: { 'tick': number };
 *     actions: { 'log': number };
 *   }>(
 *     {
 *       id: 'demo',
 *       events: ['tick'],
 *       handler: ({ event, actions }) => actions.log?.(event.payload),
 *     },
 *     runtime,
 *   );
 *   runtime.registerAction('demo', 'log', (n) => console.log(n));
 *   runtime.fireSync('tick', 42);
 */

export { createCheck } from './check.ts';
export type { CreateTriggerConfig } from './createTrigger.ts';
export { createTrigger } from './createTrigger.ts';
export type { InspectorImpl } from './inspector.ts';
export { createInspector } from './inspector.ts';
export {
  createRuntime,
  getDefaultRuntime,
  setDefaultRuntime,
} from './runtime.ts';
export type { SchedulerImpl, Task } from './scheduler.ts';
export { createScheduler } from './scheduler.ts';
export type {
  ActionChannel,
  ActionContext,
  ActionFn,
  ActionHook,
  ActionKey,
  ActionMap,
  ActionsCtx,
  CascadeContext,
  CheckCtx,
  ConcurrencyStrategy,
  ConditionGetter,
  ConditionHook,
  ConditionKey,
  ConditionMap,
  ConditionsCtx,
  EmptyRecord,
  EventHook,
  EventKey,
  EventMap,
  EventOf,
  FireContext,
  InspectorFactory,
  InspectorOption,
  InternalHandlerCtx,
  InternalTriggerConfig,
  MatchContext,
  MetaCtx,
  Middleware,
  NamedHooks,
  RegisterScopeOptions,
  RegistrationToken,
  Runtime,
  RuntimeGraph,
  RuntimeOptions,
  SchedulerStrategy,
  SkipContext,
  ToPascal,
  Trigger,
  TriggerBuilder,
  TriggerConfig,
  TriggerCtx,
  TriggerGraphNode,
  TriggerHandler,
  TriggerInspectSnapshot,
  TriggerSchema,
  UntypedActionFn,
} from './types.ts';
