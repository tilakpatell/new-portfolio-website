import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { UNIVERSES } from './universes';
import { MAP_RADIUS, ORDER, POSITIONS, keyStep } from './layout';
import './universe.css';

// The universe map drawn flat: the same layout as the 3D one, seen from the
// same tilt, with an orbit for each and a dot per universe in its colour.
// It's Home's teaser (each dot a link into the map) and the map itself when
// 3D is off (each dot a button in one focus group: the arrow keys step
// through them, Home and End jump to the ends).
const W = 600;
const H = 300;
const TILT = 0.42; // how flat the disc looks: the 3D overview's pitch, roughly
const K = (W / 2 - 34) / MAP_RADIUS;
const at = (id) => {
  const [x, y, z] = POSITIONS[id];
  return [W / 2 + x * K, H / 2 - 8 + z * K * TILT - y * K * 0.6];
};
const radius = (id) => Math.hypot(POSITIONS[id][0], POSITIONS[id][2]);

export default function MiniMap({ selected = null, onSelect, linkTo, className = '' }) {
  const list = useRef(null);
  const focusable = selected ?? ORDER[0];

  const onKeyDown = (e) => {
    if (!onSelect || e.altKey || e.ctrlKey || e.metaKey) return;
    const to = keyStep(e.key, selected);
    if (to === undefined) return;
    e.preventDefault();
    onSelect(to);
    list.current?.querySelector(`[data-id="${to}"]`)?.focus();
  };

  return (
    <div className={`minimap ${className}`} data-selected={selected || undefined}>
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="minimap-svg">
        {ORDER.map((id) => (
          <ellipse key={id} className="minimap-orbit" cx={W / 2} cy={H / 2 - 8} rx={radius(id) * K} ry={radius(id) * K * TILT} />
        ))}
        {UNIVERSES.map((u) => {
          const [x, y] = at(u.id);
          return (
            <g key={u.id} className="minimap-planet" data-on={selected === u.id || undefined}>
              {selected === u.id && <circle cx={x} cy={y} r={u.size * 11 + 6} fill="none" stroke={u.swatch} strokeOpacity="0.6" />}
              <circle cx={x} cy={y} r={u.size * 11} fill={u.swatch} />
            </g>
          );
        })}
      </svg>
      <ul ref={list} className="minimap-labels" aria-label="Universes" onKeyDown={onKeyDown}>
        {UNIVERSES.map((u) => {
          const [x, y] = at(u.id);
          const style = { left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, '--swatch': u.swatch };
          const inner = <span className="minimap-name">{u.label}</span>;
          return (
            <li key={u.id} style={style} className="minimap-item">
              {linkTo ? (
                <Link to={linkTo(u.id)} className="minimap-hit" data-id={u.id}>
                  {inner}
                </Link>
              ) : (
                <button
                  type="button"
                  className="minimap-hit"
                  data-id={u.id}
                  aria-pressed={selected === u.id}
                  tabIndex={u.id === focusable ? 0 : -1}
                  onClick={() => onSelect?.(u.id)}
                >
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
