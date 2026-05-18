/**
 * Tiny module-scoped store with a subscribe primitive — enough for
 * `useSyncExternalStore` to drive both panes off the same source of truth.
 *
 * Why a store at all? In Triggery v0.10, `useAction` is additive — every
 * component that subscribes to the same `(trigger, name)` runs on every
 * emit. You could wire every Row/Node to its own `useAction`. But fan-out
 * to N rows means N renders per emit plus cleanup churn each time a row
 * remounts. Instead, ONE reactor writes to this store and every consumer
 * reads from it.
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
