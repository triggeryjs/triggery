import type { TriggerInspectSnapshot } from '@triggery/core';

export type TriggerSnapshotViewProps = {
  readonly snapshot: TriggerInspectSnapshot;
  /**
   * `compact` renders a single-line summary suited for list rows.
   * `full` shows the snapshot as formatted JSON for detailed inspection.
   * Defaults to `compact`.
   */
  readonly variant?: 'compact' | 'full';
};

const statusColor: Record<TriggerInspectSnapshot['status'], string> = {
  fired: '#0a7a36',
  skipped: '#866808',
  errored: '#a01a1a',
  aborted: '#586069',
};

/**
 * Render one `TriggerInspectSnapshot`. Zero styling commitments — uses inline
 * styles so the component drops into any host page without a CSS pipeline.
 *
 * Authors who want richer visuals can build their own renderer on top of the
 * raw snapshot type; this is the "good defaults" view that ships with the
 * package.
 */
export function TriggerSnapshotView({ snapshot, variant = 'compact' }: TriggerSnapshotViewProps) {
  if (variant === 'full') {
    return (
      <pre
        data-triggery-snapshot={snapshot.runId}
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 12,
          background: '#f6f8fa',
          padding: 8,
          borderRadius: 4,
          overflow: 'auto',
        }}
      >
        {JSON.stringify(snapshot, null, 2)}
      </pre>
    );
  }

  return (
    <div
      data-triggery-snapshot={snapshot.runId}
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'baseline',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 12,
        padding: '4px 8px',
        borderBottom: '1px solid #eee',
      }}
    >
      <span style={{ color: statusColor[snapshot.status], fontWeight: 600, minWidth: 60 }}>
        {snapshot.status}
      </span>
      <span style={{ fontWeight: 600 }}>{snapshot.triggerId}</span>
      <span style={{ color: '#586069' }}>← {snapshot.eventName}</span>
      {snapshot.executedActions.length > 0 && (
        <span style={{ color: '#0366d6' }}>→ {snapshot.executedActions.join(', ')}</span>
      )}
      {snapshot.reason && (
        <span style={{ color: '#586069', fontStyle: 'italic' }}>({snapshot.reason})</span>
      )}
      <span style={{ marginLeft: 'auto', color: '#999' }}>{snapshot.durationMs.toFixed(2)}ms</span>
    </div>
  );
}
