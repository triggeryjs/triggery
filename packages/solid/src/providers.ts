import type { Runtime } from '@triggery/core';
import { createComponent, type JSX } from 'solid-js';
import { RuntimeContext, ScopeContext } from './context.ts';

/**
 * Provide a Triggery runtime to descendants. Required wrapper for any
 * component using `useEvent`, `useCondition` or `useAction`.
 *
 * @example
 * ```tsx
 * import { createRuntime } from '@triggery/core';
 * import { TriggerRuntimeProvider } from '@triggery/solid';
 *
 * const runtime = createRuntime();
 *
 * function App() {
 *   return (
 *     <TriggerRuntimeProvider runtime={runtime}>
 *       <Chat />
 *     </TriggerRuntimeProvider>
 *   );
 * }
 * ```
 */
export function TriggerRuntimeProvider(props: {
  runtime: Runtime;
  children: JSX.Element;
}): JSX.Element {
  return createComponent(RuntimeContext.Provider, {
    get value() {
      return props.runtime;
    },
    get children() {
      return props.children;
    },
  });
}

/**
 * Provide a scope id to descendants. Registrations inside (via
 * `useCondition` / `useAction`) only attach to triggers declared with the
 * matching `scope` in their config — see `<TriggerScope>` in
 * `@triggery/react` for the full model.
 */
export function TriggerScope(props: { id: string; children: JSX.Element }): JSX.Element {
  return createComponent(ScopeContext.Provider, {
    get value() {
      return props.id;
    },
    get children() {
      return props.children;
    },
  });
}
