/**
 * @triggery/devtools-panel — React components for inspecting a Triggery runtime.
 *
 * V1 ships two drop-in components:
 *   - `<TriggerSnapshotView snapshot>` — render one inspector snapshot
 *     (compact one-liner or expanded JSON).
 *   - `<InspectorView limit>` — live list of the most recent runs, subscribed
 *     to the active runtime via context.
 *
 * No CSS pipeline required: components use inline styles only.
 *
 * The standalone (in-browser, postMessage / WebSocket) panel + Chrome
 * extension wrapper are tracked for V1.1 — see `extensions/chrome-devtools`
 * for the manifest stub.
 *
 * @example
 * ```tsx
 * import { InspectorView } from '@triggery/devtools-panel';
 *
 * function DebugDrawer() {
 *   return import.meta.env.DEV ? <InspectorView limit={50} /> : null;
 * }
 * ```
 */

export {
  InspectorView,
  type InspectorViewProps,
} from './InspectorView.tsx';
export {
  TriggerSnapshotView,
  type TriggerSnapshotViewProps,
} from './TriggerSnapshotView.tsx';
