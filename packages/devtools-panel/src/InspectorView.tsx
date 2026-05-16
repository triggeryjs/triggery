import { useInspectHistory } from '@triggery/react';
import { useState } from 'react';
import { TriggerSnapshotView } from './TriggerSnapshotView.tsx';

export type InspectorViewProps = {
  /** How many most-recent runs to show. Default: 20. */
  readonly limit?: number;
  /** Optional title for the panel header. Pass `null` to hide. */
  readonly title?: string | null;
};

/**
 * Live list of the most recent runs from the active runtime's inspector.
 * Subscribes to the runtime so the list updates as fires happen.
 *
 * The selected row expands into a full JSON snapshot view. No external CSS
 * dependencies — uses inline styles so it drops into any host page.
 */
export function InspectorView({ limit = 20, title = 'Triggery Inspector' }: InspectorViewProps) {
  const history = useInspectHistory(limit);
  const [openRunId, setOpenRunId] = useState<string | null>(null);

  return (
    <div
      data-triggery-inspector
      style={{
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        border: '1px solid #d0d7de',
        borderRadius: 6,
        background: '#fff',
        maxWidth: 880,
      }}
    >
      {title !== null && (
        <div
          style={{
            padding: '8px 12px',
            background: '#f6f8fa',
            borderBottom: '1px solid #d0d7de',
            fontWeight: 600,
            fontSize: 13,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>{title}</span>
          <span style={{ color: '#586069', fontWeight: 400 }}>{history.length} runs</span>
        </div>
      )}
      {history.length === 0 ? (
        <div style={{ padding: 12, color: '#586069', fontSize: 12, fontStyle: 'italic' }}>
          No runs yet — fire an event to see entries here.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {history.map((snapshot) => (
            <li key={snapshot.runId}>
              <button
                type="button"
                onClick={() =>
                  setOpenRunId((prev) => (prev === snapshot.runId ? null : snapshot.runId))
                }
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                <TriggerSnapshotView snapshot={snapshot} variant="compact" />
              </button>
              {openRunId === snapshot.runId && (
                <div style={{ padding: '4px 8px' }}>
                  <TriggerSnapshotView snapshot={snapshot} variant="full" />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
