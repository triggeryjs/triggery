import { useAction, useEvent } from '@triggery/react';
import { useState } from 'react';
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
        The same entity is rendered in a diagram (SVG) and a table. Hovering a row highlights the
        matching node; hovering a node highlights the row. Clicking either pins the selection. Both
        panes are completely independent — they only share a typed event.
      </p>
      <SelectionDecorator />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <Diagram />
        <Table />
      </div>
    </main>
  );
}

/**
 * One component owns local UI state (hovered + selected) and registers
 * the two actions of the trigger. Both panes call into the trigger — the
 * decorator stays the single source of truth.
 */
function SelectionDecorator() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  useAction(selectionTrigger, 'setHovered', setHovered);
  useAction(selectionTrigger, 'setSelected', setSelected);

  // Decoration is done via two CSS custom-props on `<body>` — both panes
  // read them in their inline `style`. Keeps panes side-effect-free.
  document.body.style.setProperty('--hovered', hovered ? `"${hovered}"` : '""');
  document.body.style.setProperty('--selected', selected ? `"${selected}"` : '""');
  return null;
}

function Diagram() {
  const hover = useEvent(selectionTrigger, 'entity:hover');
  const select = useEvent(selectionTrigger, 'entity:select');
  return (
    <section>
      <h3>Diagram</h3>
      <svg width="100%" viewBox="0 0 560 280" style={{ background: '#fafafa', borderRadius: 8 }}>
        {EDGES.map(([from, to], i) => {
          const a = ENTITIES.find((e) => e.id === from);
          const b = ENTITIES.find((e) => e.id === to);
          if (!a || !b) return null;
          return (
            <line
              key={`${from}-${to}-${i}`}
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
  const [state, setState] = useState<{ hovered: boolean; selected: boolean }>({
    hovered: false,
    selected: false,
  });
  useAction(selectionTrigger, 'setHovered', (id) =>
    setState((s) => ({ ...s, hovered: id === entity.id })),
  );
  useAction(selectionTrigger, 'setSelected', (id) =>
    setState((s) => ({ ...s, selected: id === entity.id })),
  );

  const fill = state.selected ? '#af37c5' : state.hovered ? '#e6dffa' : '#fff';
  const stroke = state.selected ? '#450452' : state.hovered ? '#af37c5' : '#888';

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
        strokeWidth={state.selected ? 3 : 2}
      />
      <text
        x={entity.x}
        y={entity.y + 4}
        textAnchor="middle"
        fontSize={13}
        fill={state.selected ? '#fff' : '#333'}
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
  const [state, setState] = useState<{ hovered: boolean; selected: boolean }>({
    hovered: false,
    selected: false,
  });
  useAction(selectionTrigger, 'setHovered', (id) =>
    setState((s) => ({ ...s, hovered: id === entity.id })),
  );
  useAction(selectionTrigger, 'setSelected', (id) =>
    setState((s) => ({ ...s, selected: id === entity.id })),
  );

  const background = state.selected ? '#af37c5' : state.hovered ? '#e6dffa' : 'transparent';
  const color = state.selected ? '#fff' : '#000';
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
