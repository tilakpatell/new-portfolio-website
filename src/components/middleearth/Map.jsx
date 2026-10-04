import { useEffect, useMemo, useRef } from 'react';
import { STOPS } from './road';

// Middle-earth, drawn plainly on parchment: the coast, the Misty Mountains,
// the Anduin, the forests and the mountains around Mordor, with the road the
// Ring took from Hobbiton to Mount Doom. `step` reveals the road up to that stop.


const PLACES = [
  ['The Grey Havens', 92, 200],
  ['Isengard', 378, 362],
  ['Edoras', 418, 410],
  ['Helm’s Deep', 380, 398],
  ['Minas Tirith', 520, 444],
  ['Osgiliath', 548, 436],
  ['Barad-dûr', 712, 392],
  ['Erebor', 590, 62],
  ['Dol Guldur', 520, 252],
];

const REGIONS = [
  ['ERIADOR', 230, 120],
  ['THE SHIRE', 168, 222],
  ['RHOVANION', 620, 170],
  ['ROHAN', 452, 384],
  ['GONDOR', 470, 492],
  ['MORDOR', 680, 470],
];

// a run of little peaks along a line
function range(x0, y0, x1, y1, every = 13, size = 9) {
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / every));
  let d = '';
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n + (i % 2 ? 3 : -3);
    const y = y0 + ((y1 - y0) * i) / n;
    d += `M${x - size / 2} ${y + size / 3} L${x} ${y - size / 2} L${x + size / 2} ${y + size / 3} `;
  }
  return d;
}
// a patch of trees
function wood(cx, cy, rx, ry, seed, count = 40) {
  let s = seed;
  const r = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: count }, () => {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r());
    return [cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, 3 + r() * 2.5];
  });
}

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
      <path d="M0 0 H118 C108 78 66 118 98 170 C128 218 58 262 80 330 C100 398 40 462 62 560 H0 Z" className="map-sea" />
      <path d="M350 560 C372 524 424 504 468 520 C498 532 516 560 516 560 Z" className="map-sea" />
      {/* forests: the Old Forest, Lothlórien, Fangorn, Mirkwood */}
      {[
        [wood(282, 222, 18, 12, 7, 18), 'map-tree'],
        [wood(440, 282, 20, 16, 11, 26), 'map-tree map-tree-gold'],
        [wood(412, 334, 22, 14, 13, 26), 'map-tree'],
        [wood(540, 160, 52, 92, 17, 120), 'map-tree map-tree-dark'],
      ].map(([trees, cls], k) => (
        <g key={k} className={cls}>
          {trees.map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} />
          ))}
        </g>
      ))}
      {/* rivers: the Anduin from the north to the sea, the Brandywine, the Isen */}
      <path d="M470 50 C478 110 462 180 472 240 C482 290 476 330 488 360 C500 400 476 440 470 470 C462 500 444 512 430 524" className="map-river" />
      <path d="M210 120 C216 170 206 214 222 250 C232 280 218 320 228 360" className="map-river map-river-thin" />
      <path d="M372 360 C366 392 360 420 342 452" className="map-river map-river-thin" />
      {/* mountains: the Misty Mountains, the White Mountains, the Grey Mountains, and Mordor's walls */}
      <path d={range(372, 52, 396, 334)} className="map-peaks" />
      <path d={range(334, 432, 512, 432)} className="map-peaks" />
      <path d={range(400, 36, 566, 36)} className="map-peaks" />
      <path d={range(586, 362, 772, 362)} className="map-peaks map-peaks-dark" />
      <path d={range(578, 384, 578, 520)} className="map-peaks map-peaks-dark" />
      <path d={range(586, 520, 770, 520)} className="map-peaks map-peaks-dark" />
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
