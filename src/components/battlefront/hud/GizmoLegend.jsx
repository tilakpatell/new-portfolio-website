// The gizmo overlay's legend and labels (gizmos.js, ?gizmos=1): each kind's
// colour and count, and the nearest things' ids where they stand, over the
// deploy screen as over the field.
//
//   <GizmoLegend gizmos={{ legend: [{ kind, count, colour }], labels: [{ id, label, x, y }] }} />
const NAMES = { spawns: 'spawns', areas: 'spawn areas', volumes: 'volumes', captures: 'capture points', oob: 'out of bounds', paths: 'paths', cameras: 'cameras' };

export default function GizmoLegend({ gizmos }) {
  return (
    <>
      <ul className="bf-gizmo-legend bf-glass" aria-label="Gizmos">
        {gizmos.legend.map((l) => (
          <li key={l.kind}>
            <i style={{ background: l.colour }} />
            {NAMES[l.kind] ?? l.kind} <span className="bf-num">{l.count}</span>
          </li>
        ))}
      </ul>
      {gizmos.labels.map((l) => (
        <div key={l.id} className="bf-gizmo-label" style={{ left: l.x, top: l.y }}>
          {l.label}
        </div>
      ))}
    </>
  );
}
