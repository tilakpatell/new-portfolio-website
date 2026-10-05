import { useEffect, useMemo, useRef } from 'react';
import { FORESTS, PLACES, RANGES, REGIONS, RIVERS, SEAS, range, wood } from './mapData';
import { STOPS } from './road';
import '../../styles/lazy/middleearth.css';

// Middle-earth, drawn plainly on parchment: the coast, the Misty Mountains,
// the Anduin, the forests and the mountains around Mordor, with the road the
// Ring took from Hobbiton to Mount Doom. `step` reveals the road up to that stop.


export default function MiddleEarthMap({ step }) {
  const reveal = useRef(null);
  const legs = useMemo(() => STOPS.slice(1).map((s, i) => Math.hypot(s.x - STOPS[i].x, s.y - STOPS[i].y)), []);
  const total = legs.reduce((a, b) => a + b, 0);
  const done = legs.slice(0, step).reduce((a, b) => a + b, 0);
  const road = `M${STOPS.map((s) => `${s.x} ${s.y}`).join(' L')}`;
  useEffect(() => {
    if (reveal.current) reveal.current.style.strokeDasharray = `${done} ${total}`;
  }, [done, total]);
  const at = STOPS[step];

  return (
    <svg viewBox="0 0 800 560" className="me-map block h-auto w-full" role="img" aria-label={`A map of Middle-earth. The road so far ends at ${at.name}.`}>
      <defs>
        <radialGradient id="map-age" cx="50%" cy="50%" r="75%">
          <stop offset="0.6" stopColor="#f2e6c6" stopOpacity="0" />
          <stop offset="1" stopColor="#c9ac6c" stopOpacity="0.7" />
        </radialGradient>
        <mask id="map-road" maskUnits="userSpaceOnUse" x="0" y="0" width="800" height="560">
          <path ref={reveal} d={road} fill="none" stroke="#fff" strokeWidth="10" strokeLinejoin="round" style={{ transition: 'stroke-dasharray 0.9s ease' }} />
        </mask>
      </defs>
      <rect width="800" height="560" fill="#f2e6c6" />
      {/* the sea to the west and the bay in the south */}
      {SEAS.map((d) => (
        <path key={d} d={d} className="map-sea" />
      ))}
      {/* forests: the Old Forest, Lothlórien, Fangorn, Mirkwood */}
      {FORESTS.map(([cx, cy, rx, ry, seed, count, kind]) => (
        <g key={seed} className={kind ? `map-tree map-tree-${kind}` : 'map-tree'}>
          {wood(cx, cy, rx, ry, seed, count).map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} />
          ))}
        </g>
      ))}
      {/* rivers: the Anduin from the north to the sea, the Brandywine, the Isen */}
      {RIVERS.map(([d, thin]) => (
        <path key={d} d={d} className={thin ? 'map-river map-river-thin' : 'map-river'} />
      ))}
      {/* mountains: the Misty Mountains, the White Mountains, the Grey Mountains, and Mordor's walls */}
      {RANGES.map(([x0, y0, x1, y1, dark]) => (
        <path key={`${x0} ${y0}`} d={range(x0, y0, x1, y1)} className={dark ? 'map-peaks map-peaks-dark' : 'map-peaks'} />
      ))}
      {/* Mount Doom, burning, and the dark tower */}
      <path d="M646 432 L660 406 L674 432 Z" fill="#5a2a1a" stroke="#3a1a10" />
      <circle cx="660" cy="406" r="5" className="map-fire" />
      <path d="M708 396 V372 l4 -6 l4 6 V396 Z" fill="#2a1a14" />
      <circle cx="712" cy="364" r="3.4" className="map-fire" />
      {/* labels */}
      {REGIONS.map(([t, x, y]) => (
        <text key={t} x={x} y={y} className="map-region">
          {t}
        </text>
      ))}
      {PLACES.map(([t, x, y]) => (
        <g key={t}>
          <circle cx={x} cy={y} r="2.6" className="map-dot" />
          <text x={x + 6} y={y + 3} className="map-place">
            {t}
          </text>
        </g>
      ))}
      {/* the road: faint all the way, inked as far as the story has got */}
      <path d={road} className="map-road map-road-faint" />
      <path d={road} className="map-road" mask="url(#map-road)" />
      {STOPS.map((s, i) => (
        <g key={s.id} className="map-stop" data-reached={i <= step || undefined}>
          <circle cx={s.x} cy={s.y} r="4.2" />
          <text x={s.x + 7} y={s.y - 6} className="map-place map-place-stop">
            {s.name}
          </text>
        </g>
      ))}
      <g className="map-walker" style={{ transform: `translate(${at.x}px, ${at.y}px)` }}>
        <circle r="9" fill="#b8860b" opacity="0.25" />
        <circle r="5" fill="#8a5a12" stroke="#fff7dc" strokeWidth="1.5" />
      </g>
      {/* a compass rose */}
      <g transform="translate(742 72)" className="map-compass">
        <path d="M0 -24 L5 0 L0 24 L-5 0 Z M-24 0 L0 -5 L24 0 L0 5 Z" />
        <text y="-28" textAnchor="middle" className="map-region" style={{ fontSize: 10 }}>
          N
        </text>
      </g>
      <rect width="800" height="560" fill="url(#map-age)" pointerEvents="none" />
      <rect x="6" y="6" width="788" height="548" fill="none" stroke="#8a6d3b" strokeWidth="2" pointerEvents="none" />
    </svg>
  );
}
