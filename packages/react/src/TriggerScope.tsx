import type { ReactNode } from 'react';
import { TriggerScopeContext } from './context.ts';

export type TriggerScopeProps = {
  /**
   * Scope id. Triggers created with `scope: <this id>` in their config will see
   * the conditions/actions registered inside this subtree; triggers without a
   * matching scope will not.
   *
   * Nested scopes replace the outer one (last writer wins) — there is no
   * implicit composition.
   */
  readonly id: string;
  readonly children: ReactNode;
};

/**
 * Provide a scope id to descendants. Registrations made by `useCondition` /
 * `useAction` inside this subtree are tagged with the scope, and only triggers
 * declared with the same `scope` will receive them.
 *
 * For full isolation (separate inspector / scheduler / middleware), prefer
 * `<TriggerRuntimeProvider>` — `TriggerScope` is a lighter, in-runtime
 * partitioning.
 *
 * @example
 * ```tsx
 * const chatTrigger = createTrigger<...>({
 *   id: 'message',
 *   scope: 'chat',
 *   events: ['new-message'],
 *   handler: ({ event, actions }) => actions.showToast?.({ title: event.payload.author }),
 * });
 *
 * // useCondition / useAction inside the scope register with scope='chat'.
 * <TriggerScope id="chat">
 *   <UserProvider />
 *   <ChatToaster />
 * </TriggerScope>
 * ```
 */
export function TriggerScope({ id, children }: TriggerScopeProps) {
  return <TriggerScopeContext.Provider value={id}>{children}</TriggerScopeContext.Provider>;
}
