// Avengers Tower over Manhattan: a tapering glass shaft with a ribbed spine
// sweeping up its right side to the cantilevered landing deck, an angled crown
// with its band of windows and the A, and the slanted spire. Haze, cloud and the
// city around it; at night the windows light up. `floors` are the stops from
// the top down and `current` lights the lift at that floor.

const W = 400;
const H = 900;
const STREET = 884;

// the shaft's edges, so lines can be drawn across it at any height
const LEFT = (y) => 168 + ((STREET - y) * 8) / (STREET - 330);
const RIGHT = (y) => 262 - ((STREET - y) * 16) / (STREET - 312);

// the spine: two cubic curves (outer and inner edge), sampled for the ribs
const bez = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};
const OUTER = [
  [302, STREET],
  [298, 640],
  [272, 430],
  [247, 318],
];
const INNER = [
  [272, STREET],
  [270, 650],
  [256, 440],
  [245, 332],
];
const at = (c, t) => [bez(c[0][0], c[1][0], c[2][0], c[3][0], t), bez(c[0][1], c[1][1], c[2][1], c[3][1], t)];
const SPINE = `M${OUTER[0].join(' ')} C${OUTER.slice(1)
  .map((p) => p.join(' '))
  .join(', ')} L${INNER[3].join(' ')} C${[INNER[2], INNER[1], INNER[0]].map((p) => p.join(' ')).join(', ')} Z`;
const RIBS = Array.from({ length: 46 }, (_, i) => {
  const t = i / 46;
  return [at(OUTER, t), at(INNER, t)];
});
const FLOOR_LINES = Array.from({ length: 70 }, (_, i) => 344 + i * 7.8);

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const r = rng(2012);
// lit windows for the night, on the tower
const LIT = Array.from({ length: 110 }, () => {
  const y = 350 + r() * 520;
  const x = LEFT(y) + 6 + r() * (RIGHT(y) - LEFT(y) - 12);
  return [x, y];
});
const CITY = [
  // the far skyline, behind the haze
  ...Array.from({ length: 16 }, (_, i) => ({ layer: 'far', x: i * 26 - 6, w: 22 + r() * 10, top: 600 + r() * 120 })),
  // the blocks either side of the tower
  { layer: 'mid', x: -10, w: 74, top: 520 },
  { layer: 'mid', x: 60, w: 52, top: 610 },
  { layer: 'mid', x: 306, w: 58, top: 560 },
  { layer: 'mid', x: 356, w: 60, top: 500 },
  { layer: 'near', x: -6, w: 120, top: 760 },
  { layer: 'near', x: 300, w: 110, top: 740 },
];

export default function Tower({ floors, current = 0, className = '' }) {
  const lift = (i) => 352 + (i * (STREET - 30 - 352)) / Math.max(1, floors.length - 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" className={`tower-svg ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id="tw-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--tw-sky-top)" />
          <stop offset="0.7" stopColor="var(--tw-sky-mid)" />
          <stop offset="1" stopColor="var(--tw-sky-bottom)" />
        </linearGradient>
        <linearGradient id="tw-glass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--tw-glass-lit)" />
          <stop offset="0.45" stopColor="var(--tw-glass-mid)" />
          <stop offset="1" stopColor="var(--tw-glass-shade)" />
        </linearGradient>
        <linearGradient id="tw-crown" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--tw-crown-lit)" />
          <stop offset="1" stopColor="var(--tw-crown-shade)" />
        </linearGradient>
        <linearGradient id="tw-spine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--tw-spine-lit)" />
          <stop offset="1" stopColor="var(--tw-spine-shade)" />
        </linearGradient>
        <linearGradient id="tw-streak" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="var(--tw-streak)" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="tw-haze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--tw-haze)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--tw-haze)" stopOpacity="0.85" />
        </linearGradient>
        <radialGradient id="tw-lift">
          <stop offset="0" stopColor="#fff6c8" />
          <stop offset="1" stopColor="#ffb020" stopOpacity="0" />
        </radialGradient>
        <filter id="tw-soft" x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      <rect width={W} height={H} fill="url(#tw-sky)" />
      {/* clouds */}
      <g filter="url(#tw-soft)" className="tw-clouds">
        <ellipse cx="80" cy="120" rx="70" ry="16" />
        <ellipse cx="120" cy="108" rx="40" ry="14" />
        <ellipse cx="330" cy="200" rx="80" ry="14" />
        <ellipse cx="300" cy="190" rx="40" ry="12" />
        <ellipse cx="60" cy="420" rx="70" ry="12" />
        <ellipse cx="350" cy="470" rx="60" ry="11" />
      </g>
      {/* the far city, in haze */}
      {CITY.filter((b) => b.layer === 'far').map((b, i) => (
        <rect key={i} x={b.x} y={b.top} width={b.w} height={H - b.top} className="tw-far" />
      ))}
      <rect y="560" width={W} height={H - 560} fill="url(#tw-haze)" />
      {CITY.filter((b) => b.layer === 'mid').map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={b.top} width={b.w} height={H - b.top} className="tw-mid" />
          {Array.from({ length: Math.floor((H - b.top) / 14) }, (_, k) => (
            <path key={k} d={`M${b.x + 4} ${b.top + 8 + k * 14} H${b.x + b.w - 4}`} className="tw-mid-floor" />
          ))}
        </g>
      ))}

      {/* the spire, behind the crown */}
      <path d="M184 206 L210 54 L216 56 L198 204 Z" fill="url(#tw-crown)" stroke="var(--tw-edge)" strokeWidth="0.8" />
      <circle cx="212" cy="56" r="2.6" className="tw-beacon" />

      {/* the shaft: glass, floor lines, a streak of reflected sky */}
      <path d={`M168 ${STREET} L176 330 L246 312 L262 ${STREET} Z`} fill="url(#tw-glass)" stroke="var(--tw-edge)" strokeWidth="1" />
      {FLOOR_LINES.map((y) => (
        <path key={y} d={`M${LEFT(y)} ${y} L${RIGHT(y)} ${y - 2}`} className="tw-floor-line" />
      ))}
      {[0.25, 0.5, 0.75].map((k) => (
        <path key={k} d={`M${168 + 94 * k} ${STREET} L${176 + 70 * k} ${330 - 18 * k}`} className="tw-mullion" />
      ))}
      <path d={`M182 ${STREET} L190 334 L204 330 L198 ${STREET} Z`} fill="url(#tw-streak)" />
      <g className="tw-lit">
        {LIT.map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="3" height="2" />
        ))}
      </g>

      {/* the spine, ribbed, sweeping up to the deck */}
      <path d={SPINE} fill="url(#tw-spine)" stroke="var(--tw-edge)" strokeWidth="0.8" />
      {RIBS.map(([a, b], i) => (
        <path key={i} d={`M${a[0]} ${a[1]} L${b[0]} ${b[1]}`} className="tw-rib" />
      ))}

      {/* the crown: the angled block, its window band, the A */}
      <path d="M172 334 L168 262 L250 240 L262 318 Z" fill="url(#tw-crown)" stroke="var(--tw-edge)" strokeWidth="1" />
      <path d="M168 262 L176 202 L270 188 L296 214 L250 240 Z" fill="url(#tw-crown)" stroke="var(--tw-edge)" strokeWidth="1" />
      <path d="M176 222 L272 205 L284 218 L178 242 Z" className="tw-band" />
      <path d="M180 226 L230 217" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.2" />
      <circle cx="196" cy="296" r="18" className="tw-badge" />
      <path d="M187.5 306 L196 284 L204.5 306 M190.5 299 L209 299" className="tw-a" />

      {/* the landing deck, cantilevered out to the right */}
      <path d="M252 300 C276 296 300 286 330 276" className="tw-strut" />
      <path d="M250 240 C300 233 352 238 388 254 C378 264 318 268 256 264 Z" fill="var(--tw-deck)" stroke="var(--tw-edge)" strokeWidth="0.8" />
      <path d="M256 264 C318 268 378 264 388 254 L386 262 C360 276 300 280 258 274 Z" fill="var(--tw-deck-under)" />
      <path d="M262 246 C310 240 350 244 380 254" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="0.8" fill="none" />
      <g className="tw-deck-lights">
        {[270, 292, 314, 336, 358, 378].map((x, i) => (
          <circle key={x} cx={x} cy={263 + (i > 3 ? -1 : 0)} r="1.2" />
        ))}
      </g>

      {/* the podium, and the near blocks in front */}
      <path d={`M150 ${STREET} H282 V${H} H150 Z`} className="tw-podium" />
      {CITY.filter((b) => b.layer === 'near').map((b, i) => (
        <rect key={i} x={b.x} y={b.top} width={b.w} height={H - b.top} className="tw-near" />
      ))}

      {/* the lift, at the current floor */}
      {floors?.length > 0 && (
        <g className="tw-liftcar" style={{ transform: `translateY(${lift(current)}px)` }}>
          <ellipse cx="215" cy="0" rx="34" ry="7" fill="url(#tw-lift)" />
          <rect x="196" y="-2" width="38" height="4" rx="2" fill="#ffd25a" />
        </g>
      )}
    </svg>
  );
}
