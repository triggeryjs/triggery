/**
 * @triggery/devtools-redux — bridge Triggery middleware events into the
 * Redux DevTools browser extension.
 *
 * Drop the middleware into a runtime in DEV and every fire / skip / action /
 * cascade event shows up in the Redux DevTools panel, with payload + a
 * growing run history as "state". No Redux required — the extension can host
 * any source.
 *
 * @example
 * ```ts
 * import { createRuntime } from '@triggery/core';
 * import { reduxDevtoolsMiddleware } from '@triggery/devtools-redux';
 *
 * const runtime = createRuntime({
 *   middleware: import.meta.env.DEV ? [reduxDevtoolsMiddleware({ name: 'My App' })] : [],
 * });
 * ```
 */

import type { Middleware } from '@triggery/core';

/** Minimal subset of the Redux DevTools API we actually use. */
type ReduxDevToolsConnection = {
  init(state: unknown): void;
  send(action: string | { type: string; [k: string]: unknown }, state: unknown): void;
  unsubscribe?(): void;
};

type ReduxDevToolsExtension = {
  connect(options?: { name?: string; trace?: boolean }): ReduxDevToolsConnection;
};

type GlobalWithRDT = {
  __REDUX_DEVTOOLS_EXTENSION__?: ReduxDevToolsExtension;
};

export type DevtoolsReduxOptions = {
  /** Display name in the DevTools "Inspector → Stores" dropdown. */
  readonly name?: string;
  /** How many recent runs to keep in `state.history` (default: 200). */
  readonly historyLimit?: number;
};

/**
 * Single history entry recorded in the devtools state — keep it flat and
 * JSON-stringifiable so the extension can serialize it across postMessage.
 */
export type DevtoolsHistoryEntry = {
  readonly type: string;
  readonly at: number;
  readonly eventName?: string;
  readonly triggerId?: string;
  readonly actionName?: string;
  readonly reason?: string;
  readonly payload?: unknown;
  readonly cascadeKind?: 'overflow' | 'cycle';
  readonly cascadeDepth?: number;
};

export type DevtoolsState = {
  readonly history: readonly DevtoolsHistoryEntry[];
};

/**
 * Construct the middleware. If no Redux DevTools extension is present (Node,
 * production, browser without the extension) it returns a quiet no-op so the
 * runtime stays cheap.
 */
export function reduxDevtoolsMiddleware(options: DevtoolsReduxOptions = {}): Middleware {
  const name = options.name ?? 'Triggery';
  const limit = options.historyLimit ?? 200;
  const ext = (globalThis as GlobalWithRDT).__REDUX_DEVTOOLS_EXTENSION__;

  if (!ext) {
    // No extension available — emit a middleware whose hooks are absent, so the
    // dispatcher's `needsTiming()` check stays "cold" and no per-call cost is
    // paid. Returning a `name`-only middleware is the cheapest no-op shape.
    return { name: 'devtools-redux' };
  }

  const conn = ext.connect({ name, trace: false });
  const history: DevtoolsHistoryEntry[] = [];
  conn.init({ history });

  const push = (entry: DevtoolsHistoryEntry): void => {
    history.push(entry);
    if (history.length > limit) history.splice(0, history.length - limit);
    conn.send({ type: entry.type }, { history });
  };

  return {
    name: 'devtools-redux',
    onFire: (ctx) =>
      push({
        type: `triggery/fire:${ctx.eventName}`,
        at: Date.now(),
        eventName: ctx.eventName,
        payload: ctx.payload,
      }),
    onSkip: (ctx) =>
      push({
        type: `triggery/skip:${ctx.triggerId}:${ctx.reason}`,
        at: Date.now(),
        triggerId: ctx.triggerId,
        eventName: ctx.eventName,
        reason: ctx.reason,
      }),
    onActionStart: (ctx) =>
      push({
        type: `triggery/action-start:${ctx.triggerId}.${ctx.actionName}`,
        at: Date.now(),
        triggerId: ctx.triggerId,
        actionName: ctx.actionName,
        payload: ctx.payload,
      }),
    onActionEnd: (ctx) =>
      push({
        type: `triggery/action-end:${ctx.triggerId}.${ctx.actionName}`,
        at: Date.now(),
        triggerId: ctx.triggerId,
        actionName: ctx.actionName,
      }),
    onError: (ctx) =>
      push({
        type: `triggery/error:${ctx.triggerId}.${ctx.actionName}`,
        at: Date.now(),
        triggerId: ctx.triggerId,
        actionName: ctx.actionName,
        payload: String(ctx.error),
      }),
    onCascade: (ctx) =>
      push({
        type: `triggery/cascade:${ctx.kind}`,
        at: Date.now(),
        triggerId: ctx.parentTriggerId,
        eventName: ctx.newEventName,
        cascadeKind: ctx.kind,
        cascadeDepth: ctx.cascadeDepth,
      }),
  };
}
