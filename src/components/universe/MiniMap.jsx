import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { UNIVERSES } from './universes';
import { BELT, MAP_RADIUS, ORDER, POSITIONS, SUN, keyStep } from './layout';
import './universe.css';

// The universe map drawn flat: the same layout as the 3D one, seen from the
// same tilt, with the sun in the middle, the asteroid belt, an orbit for each
// and a dot per place in its colour. It's Home's teaser (just the fandoms, each dot a link
// into the map) and the map itself when 3D is off (every place, each a
// button in one focus group: the arrow keys step through them, Home and End
// jump to the ends).
const W = 600;
const H = 300;
const TILT = 0.42; // how flat the disc looks: the 3D overview's pitch, roughly
// the far worlds are thousands of units out and the stations a hundred and more: drawn
// to a square-root scale, so the home system opens up and the worlds still fit
const K = W / 2 - 34;
const scaled = (r) => Math.sqrt(Math.max(0, r) / MAP_RADIUS) * K;
const at = (id) => {
  const [x, y, z] = POSITIONS[id];
  const r = Math.hypot(x, z) || 1;
  const k = scaled(r) / r;
  return [W / 2 + x * k, H / 2 - 8 + z * k * TILT - (y / MAP_RADIUS) * K * 0.5];
};
const radius = (id) => Math.hypot(POSITIONS[id][0], POSITIONS[id][2]);
// a place's dot: bigger than its true size on this scale, so it reads
const dot = (u) => 5 + Math.min(7, u.size * 0.2);
// one orbit per distinct radius (the stations share theirs)
const ORBITS = [...new Set(ORDER.map((id) => radius(id).toFixed(3)))].map(Number);

export default function MiniMap({ selected = null, onSelect, linkTo, kind = null, className = '' }) {
  const shown = kind ? UNIVERSES.filter((u) => u.kind === kind) : UNIVERSES;
  const radii = kind ? [...new Set(shown.map((u) => radius(u.id).toFixed(3)))].map(Number) : ORBITS;
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
        {radii.map((r) => (
          <ellipse key={r} className="minimap-orbit" cx={W / 2} cy={H / 2 - 8} rx={scaled(r)} ry={scaled(r) * TILT} />
        ))}
        {/* the asteroid belt, a dotted band between the stations and the planets */}
        <ellipse cx={W / 2} cy={H / 2 - 8} rx={scaled((BELT.inner + BELT.outer) / 2)} ry={scaled((BELT.inner + BELT.outer) / 2) * TILT} fill="none" stroke="#9a8f80" strokeOpacity="0.35" strokeWidth={(scaled(BELT.outer) - scaled(BELT.inner)) * 0.5} strokeDasharray="1 3" />
        <circle cx={W / 2} cy={H / 2 - 8} r={Math.max(3, scaled(SUN.r) * 0.35)} fill="#ffb347" opacity="0.9" />
        {shown.map((u) => {
          const [x, y] = at(u.id);
          return (
            <g key={u.id} className="minimap-planet" data-on={selected === u.id || undefined}>
              {selected === u.id && <circle cx={x} cy={y} r={dot(u) + 6} fill="none" stroke={u.swatch} strokeOpacity="0.6" />}
              <circle cx={x} cy={y} r={dot(u)} fill={u.swatch} />
            </g>
          );
        })}
      </svg>
      <ul ref={list} className="minimap-labels" aria-label="Universes" onKeyDown={onKeyDown}>
        {shown.map((u) => {
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
