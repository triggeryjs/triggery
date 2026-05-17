import { useAction, useEvent } from '@triggery/react';
import { setHoveredId, setSelectedId, useSelection } from './store.ts';
import { selectionTrigger } from './triggers/index.ts';

type Entity = { id: string; label: string; x: number; y: number };

const ENTITIES: Entity[] = [
  { id: 'a', label: 'Order', x: 100, y: 60 },
  { id: 'b', label: 'Invoice', x: 280, y: 60 },
  { id: 'c', label: 'Customer', x: 100, y: 200 },
  { id: 'd', label: 'Product', x: 280, y: 200 },
  { id: 'e', label: 'Shipment', x: 460, y: 130 },
];

const EDGES: Array<[string, string]> = [
  ['a', 'b'],
  ['a', 'c'],
  ['a', 'd'],
  ['a', 'e'],
  ['c', 'a'],
];

export function App() {
  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: 24,
        maxWidth: 880,
        margin: '0 auto',
      }}
    >
      <h1>Triggery — diagram ⇄ table selection sync</h1>
      <p>
        The same entity is rendered in a diagram (SVG) and a table. Hovering or clicking either
        pane reflects in the other — without lifted state, prop drilling or a shared parent. The
        trigger handler routes events into a tiny store; both panes read from it.
      </p>
      <StoreBridge />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <Diagram />
        <Table />
      </div>
    </main>
  );
}

/**
 * The single reactor for the trigger. Registers `setHovered` / `setSelected`
 * exactly once and forwards the payload to the module-scoped store. Mount
 * it anywhere under the app — no Diagram/Table coupling needed.
 */
function StoreBridge() {
  useAction(selectionTrigger, 'setHovered', setHoveredId);
  useAction(selectionTrigger, 'setSelected', setSelectedId);
  return null;
}

function Diagram() {
  const hover = useEvent(selectionTrigger, 'entity:hover');
  const select = useEvent(selectionTrigger, 'entity:select');
  return (
    <section>
      <h3>Diagram</h3>
      <svg width="100%" viewBox="0 0 560 280" style={{ background: '#fafafa', borderRadius: 8 }}>
        <title>Entity diagram</title>
        {EDGES.map(([from, to]) => {
          const a = ENTITIES.find((e) => e.id === from);
          const b = ENTITIES.find((e) => e.id === to);
          if (!a || !b) return null;
          return (
            <line
              key={`${from}-${to}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#bbb"
              strokeWidth={2}
            />
          );
        })}
        {ENTITIES.map((e) => (
          <Node key={e.id} entity={e} onHover={hover} onSelect={select} />
        ))}
      </svg>
    </section>
  );
}

function Node({
  entity,
  onHover,
  onSelect,
}: {
  entity: Entity;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}) {
  const { hoveredId, selectedId } = useSelection();
  const hovered = hoveredId === entity.id;
  const selected = selectedId === entity.id;

  const fill = selected ? '#af37c5' : hovered ? '#e6dffa' : '#fff';
  const stroke = selected ? '#450452' : hovered ? '#af37c5' : '#888';

  return (
    <g
      style={{ cursor: 'pointer' }}
      onMouseEnter={() => onHover(entity.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(entity.id)}
    >
      <rect
        x={entity.x - 50}
        y={entity.y - 18}
        width={100}
        height={36}
        rx={6}
        fill={fill}
        stroke={stroke}
        strokeWidth={selected ? 3 : 2}
      />
      <text
        x={entity.x}
        y={entity.y + 4}
        textAnchor="middle"
        fontSize={13}
        fill={selected ? '#fff' : '#333'}
      >
        {entity.label}
      </text>
    </g>
  );
}

function Table() {
  const hover = useEvent(selectionTrigger, 'entity:hover');
  const select = useEvent(selectionTrigger, 'entity:select');
  return (
    <section>
      <h3>Table</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>Id</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>Label</th>
          </tr>
        </thead>
        <tbody>
          {ENTITIES.map((e) => (
            <Row key={e.id} entity={e} onHover={hover} onSelect={select} />
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Row({
  entity,
  onHover,
  onSelect,
}: {
  entity: Entity;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}) {
  const { hoveredId, selectedId } = useSelection();
  const hovered = hoveredId === entity.id;
  const selected = selectedId === entity.id;

  const background = selected ? '#af37c5' : hovered ? '#e6dffa' : 'transparent';
  const color = selected ? '#fff' : '#000';

  return (
    <tr
      style={{ background, color, cursor: 'pointer' }}
      onMouseEnter={() => onHover(entity.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(entity.id)}
    >
      <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{entity.id}</td>
      <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{entity.label}</td>
    </tr>
  );
}
