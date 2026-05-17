/**
 * Tiny module-scoped store with a subscribe primitive — enough for
 * `useSyncExternalStore` to drive both panes off the same source of truth.
 *
 * Why a store at all? In Triggery, `useAction` registrations are
 * last-mount-wins — only the latest-mounted reactor for a given action
 * actually runs. That's correct for "I am THE side-effect for this rule".
 * It's wrong for fanout-to-N: if every Row/Node tried to be its own
 * reactor, only the last-mounted one would update. Instead, ONE reactor
 * writes to this store and every consumer reads from it.
 *
 * This is the standard split: the trigger orchestrates the rule, a tiny
 * store holds the resulting state, the views consume that state. In a
 * larger app the "store" would be Zustand / Redux / Jotai / Signals —
 * here we keep it dependency-free to keep the example self-contained.
 */
import { useSyncExternalStore } from 'react';

type State = { hoveredId: string | null; selectedId: string | null };

let state: State = { hoveredId: null, selectedId: null };
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function setHoveredId(id: string | null) {
  if (state.hoveredId === id) return;
  state = { ...state, hoveredId: id };
  notify();
}

export function setSelectedId(id: string | null) {
  if (state.selectedId === id) return;
  state = { ...state, selectedId: id };
  notify();
}

const getSnapshot = () => state;

export function useSelection(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
