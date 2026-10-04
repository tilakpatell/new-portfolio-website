import { useRef, useState } from 'react';

// The West-gate of Moria, after Tolkien's drawing in The Fellowship of the
// Ring: two pillars and an arch carrying the inscription, the crown and seven
// stars over Durin's hammer and anvil, two trees bearing crescent moons, and
// the many-rayed star of Fëanor. The lines are ithildin: in the dark they show
// only where the light falls (the pointer), and the moon brings out the rest.

const C = 200; // the doors' centre line
const SPRING = 170; // where the arch springs from the pillars
const R_OUT = 96;
const R_IN = 78;
const R_TEXT = 87;

const LEAF_L = `M122 400 V${SPRING} A${R_IN} ${R_IN} 0 0 1 ${C} ${SPRING - R_IN} V400 Z`;
const LEAF_R = `M${C} 400 V${SPRING - R_IN} A${R_IN} ${R_IN} 0 0 1 278 ${SPRING} V400 Z`;
const DOORWAY = `M122 400 V${SPRING} A${R_IN} ${R_IN} 0 0 1 278 ${SPRING} V400 Z`;

// A crescent moon opening to the right (or the left when `flip`).
const crescent = (cx, cy, r, flip = false) => {
  const s = flip ? 1 : 0;
  return `M${cx} ${cy - r} A${r} ${r} 0 1 ${s} ${cx} ${cy + r} A${r * 0.62} ${r} 0 1 ${1 - s} ${cx} ${cy - r} Z`;
};

// One tree, drawn for the left side; the right one is its mirror.
const TREE = {
  lines: [
    'M150 400 C149 360 152 320 150 280 C148 250 151 220 150 192',
    'M150 288 C140 276 132 266 130 250',
    'M150 272 C158 262 162 254 160 244',
    'M150 236 C142 226 138 214 138 201',
    'M150 222 C156 212 160 204 160 196',
    'M150 400 C144 397 138 398 132 401',
    'M150 400 C156 397 162 398 168 401',
  ],
  moons: [
    [129, 246, 4.5],
    [161, 240, 4],
    [137, 197, 4.5],
    [161, 192, 4],
    [150, 185, 5.5],
  ],
};
// every number in these paths is an x, y pair, so flip every other one
const mirror = (d) => {
  let i = 0;
  return d.replace(/-?\d+\.?\d*/g, (n) => (i++ % 2 === 0 ? String(400 - Number(n)) : n));
};

const SEVEN_STARS = [210, 230, 250, 270, 290, 310, 330].map((a) => {
  const t = (a * Math.PI) / 180;
  return [C + 24 * Math.cos(t), 132 + 24 * Math.sin(t)];
});
const sparkle = (x, y, r = 3.2) => `M${x} ${y - r} L${x + r * 0.28} ${y - r * 0.28} L${x + r} ${y} L${x + r * 0.28} ${y + r * 0.28} L${x} ${y + r} L${x - r * 0.28} ${y + r * 0.28} L${x - r} ${y} L${x - r * 0.28} ${y - r * 0.28} Z`;

// Fëanor's star: eight long rays, eight shorter between, sixteen short ones between those.
const STAR = { x: C, y: 238 };
const RAYS = Array.from({ length: 32 }, (_, i) => {
  const a = (i / 32) * Math.PI * 2 - Math.PI / 2;
  const len = i % 4 === 0 ? 32 : i % 2 === 0 ? 20 : 12;
  return { x1: STAR.x + Math.cos(a) * 5, y1: STAR.y + Math.sin(a) * 5, x2: STAR.x + Math.cos(a) * len, y2: STAR.y + Math.sin(a) * len, w: i % 4 === 0 ? 1.3 : i % 2 === 0 ? 1 : 0.7 };
});

// A tentacle of the Watcher in the Water: a tapered band along a cubic curve.
function tentacle([p0, p1, p2, p3], w0) {
  const pt = (t) => {
    const u = 1 - t;
    return [0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]);
  };
  const left = [];
  const right = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const [x, y] = pt(t);
    const [x2, y2] = pt(Math.min(1, t + 0.01));
    const [x1, y1] = pt(Math.max(0, t - 0.01));
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const w = (w0 * (1 - t) ** 0.8) / 2;
    left.push(`${(x - (dy / len) * w).toFixed(1)} ${(y + (dx / len) * w).toFixed(1)}`);
    right.unshift(`${(x + (dy / len) * w).toFixed(1)} ${(y - (dx / len) * w).toFixed(1)}`);
  }
  return `M${left.join(' L')} L${right.join(' L')} Z`;
}
const TENTACLES = [
  tentacle([[56, 474], [48, 420], [40, 380], [70, 352]], 11),
  tentacle([[92, 474], [96, 430], [120, 410], [110, 380]], 9),
  tentacle([[24, 474], [20, 440], [8, 410], [26, 392]], 8),
];

function DoorArt() {
  const lines = [...TREE.lines, ...TREE.lines.map(mirror)];
  return (
    <g className="me-ithil-art">
      {lines.map((d, i) => (
        <path key={d} d={d} className="me-line" pathLength="1" style={{ '--i': 6 + (i % 7) }} />
      ))}
      {TREE.moons.map(([x, y, r]) => (
        <g key={`${x}-${y}`}>
          <path d={crescent(x, y, r)} className="me-fill" />
          <path d={crescent(400 - x, y, r, true)} className="me-fill" />
        </g>
      ))}
      {RAYS.map((r, i) => (
        <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} className="me-line" pathLength="1" style={{ strokeWidth: r.w, '--i': 12 + (i % 8) * 0.25 }} />
      ))}
      <circle cx={STAR.x} cy={STAR.y} r="3.4" className="me-fill" />
      {SEVEN_STARS.map(([x, y]) => (
        <path key={x} d={sparkle(x, y)} className="me-fill" />
      ))}
      <path d="M189 146 V136 L194 141 L197 132 L200 139 L203 132 L206 141 L211 136 V146 Z" className="me-line" pathLength="1" style={{ '--i': 10 }} />
      <path d="M190 151 L197 148 L200 155 L193 158 Z M197 152 L214 146" className="me-line" pathLength="1" style={{ '--i': 10.5 }} />
      <path d="M184 160 H216 V164 H206 V170 H212 V174 H188 V170 H194 V164 H184 Z" className="me-line" pathLength="1" style={{ '--i': 11 }} />
    </g>
  );
}

export default function Doors({ lit, open, watcher, onMoon }) {
  const svg = useRef(null);
  const [spot, setSpot] = useState(null);
  const frame = useRef(0);

  // In the dark, the pointer is the light.
  const onMove = (e) => {
    if (lit) return;
    const el = svg.current;
    const ctm = el?.getScreenCTM();
    if (!ctm) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => setSpot({ x: p.x, y: p.y }));
  };

  const state = open ? 'open' : lit ? 'lit' : 'dark';
  return (
    <svg
      ref={svg}
      viewBox="0 0 400 470"
      className="me-doors block h-auto w-full"
      data-state={state}
      data-watcher={watcher || undefined}
      role="img"
      aria-label={
        open
          ? 'The Doors of Durin, standing open on the dark of Moria'
          : lit
            ? 'The Doors of Durin, their silver lines shining in the moonlight'
            : 'A sheer cliff by a dark lake at night. Faint lines show where the light falls'
      }
      onPointerMove={onMove}
      onPointerDown={onMove}
      onPointerLeave={() => setSpot(null)}
    >
      <defs>
        <linearGradient id="me-cliff" gradientUnits="userSpaceOnUse" x1="0" y1="40" x2="0" y2="414">
          <stop offset="0" stopColor="#3b414c" />
          <stop offset="0.55" stopColor="#2b3039" />
          <stop offset="1" stopColor="#1b1f26" />
        </linearGradient>
        <linearGradient id="me-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#070a14" />
          <stop offset="1" stopColor="#141b2e" />
        </linearGradient>
        <linearGradient id="me-lake" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d1526" />
          <stop offset="1" stopColor="#05080f" />
        </linearGradient>
        <radialGradient id="me-deep" cx="50%" cy="62%" r="60%">
          <stop offset="0" stopColor="#1a130e" />
          <stop offset="1" stopColor="#030303" />
        </radialGradient>
        <radialGradient id="me-spot-grad">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="me-spot" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="470">
          <rect width="400" height="470" fill="#262626" />
          {spot && <circle cx={spot.x} cy={spot.y} r="78" fill="url(#me-spot-grad)" />}
        </mask>
        <clipPath id="me-leaf-l">
          <path d={LEAF_L} />
        </clipPath>
        <clipPath id="me-leaf-r">
          <path d={LEAF_R} />
        </clipPath>
        <filter id="me-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.7" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <path id="me-arch-text" d={`M${C - R_TEXT} ${SPRING} A${R_TEXT} ${R_TEXT} 0 0 1 ${C + R_TEXT} ${SPRING}`} />
      </defs>

      {/* the night, the moon behind cloud until it's called */}
      <rect width="400" height="90" fill="url(#me-sky)" />
      {Array.from({ length: 18 }, (_, i) => (
        <circle key={i} cx={(i * 89) % 400} cy={6 + ((i * 37) % 52)} r={i % 5 === 0 ? 1.1 : 0.6} fill="#dfe6ff" opacity={0.35 + (i % 3) * 0.2} />
      ))}
      <g className="me-moon" onClick={onMoon}>
        <circle cx="338" cy="34" r="22" fill="#f4f1e1" opacity="0.12" />
        <circle cx="338" cy="34" r="13" fill="#f4f1e1" />
        <g className="me-clouds">
          <ellipse cx="330" cy="36" rx="36" ry="10" fill="#222a3c" />
          <ellipse cx="352" cy="29" rx="24" ry="9" fill="#283146" />
          <ellipse cx="316" cy="28" rx="20" ry="7" fill="#1d2435" />
        </g>
      </g>

      {/* the cliff, the lake, two holly trees */}
      <path d="M0 74 L36 56 L84 66 L132 46 L196 58 L254 42 L312 62 L364 48 L400 60 V414 H0 Z" fill="url(#me-cliff)" />
      {[120, 150, 205, 260, 318, 372].map((y, i) => (
        <path key={y} d={`M0 ${y} C 90 ${y - 6 + i} 180 ${y + 8} 260 ${y + 2} S 360 ${y - 4} 400 ${y + 3}`} fill="none" stroke="#000" strokeOpacity="0.16" strokeWidth="1" />
      ))}
      <rect y="410" width="400" height="60" fill="url(#me-lake)" />
      {[428, 440, 452, 463].map((y, i) => (
        <path key={y} d={`M${30 + i * 40} ${y} h${60 + i * 30}`} stroke="#9fb4ff" strokeOpacity="0.08" strokeWidth="1" />
      ))}
      <ellipse className="me-glint" cx="338" cy="446" rx="5" ry="20" fill="#f4f1e1" />
      <path d="M0 406 H400 V414 H0 Z" fill="#161a20" />
      {[34, 366].map((x) => (
        <g key={x} fill="#10141b">
          <rect x={x - 4} y="300" width="8" height="110" />
          <circle cx={x} cy="262" r="30" />
          <circle cx={x - 18} cy="290" r="22" />
          <circle cx={x + 18} cy="292" r="22" />
          <circle cx={x} cy="228" r="22" />
        </g>
      ))}

      {/* what lies behind the doors, and the doors themselves */}
      <path d={DOORWAY} fill="url(#me-deep)" />
      {[392, 380, 370].map((y, i) => (
        <path key={y} d={`M${140 + i * 10} ${y} H${260 - i * 10}`} stroke="#3a2d22" strokeWidth="1.2" opacity="0.7" />
      ))}
      {/* the stone of the doors hides them; only the ithildin on it shows, and
          in the dark only where the light falls */}
      <g className="me-leaf me-leaf-l">
        <path d={LEAF_L} fill="url(#me-cliff)" />
        <g clipPath="url(#me-leaf-l)" filter="url(#me-glow)" mask={lit ? undefined : 'url(#me-spot)'}>
          <DoorArt />
        </g>
        <path d={LEAF_L} className="me-leaf-shade" />
      </g>
      <g className="me-leaf me-leaf-r">
        <path d={LEAF_R} fill="url(#me-cliff)" />
        <g clipPath="url(#me-leaf-r)" filter="url(#me-glow)" mask={lit ? undefined : 'url(#me-spot)'}>
          <DoorArt />
        </g>
        <path d={LEAF_R} className="me-leaf-shade" />
      </g>
      <g className="me-frame" filter="url(#me-glow)" mask={lit ? undefined : 'url(#me-spot)'}>
        <path d={`M104 400 V180 M122 400 V180 M278 400 V180 M296 400 V180`} className="me-line" pathLength="1" style={{ '--i': 0 }} />
        <path d={`M${C - R_OUT} ${SPRING} A${R_OUT} ${R_OUT} 0 0 1 ${C + R_OUT} ${SPRING}`} className="me-line" pathLength="1" style={{ '--i': 2 }} />
        <path d={`M${C - R_IN} ${SPRING} A${R_IN} ${R_IN} 0 0 1 ${C + R_IN} ${SPRING}`} className="me-line" pathLength="1" style={{ '--i': 2.5 }} />
        <path d="M98 170 H128 V180 H98 Z M272 170 H302 V180 H272 Z M98 400 H128 V406 H98 Z M272 400 H302 V406 H272 Z" className="me-line" pathLength="1" style={{ '--i': 1 }} />
        <text className="me-inscription" fontSize="8.2">
          <textPath href="#me-arch-text" startOffset="50%" textAnchor="middle" textLength="258" lengthAdjust="spacing">
            ENNYN DURIN ARAN MORIA · PEDO MELLON A MINNO
          </textPath>
        </text>
      </g>

      {/* the Watcher in the Water, if you keep it waiting */}
      <g className="me-watcher" fill="#2f3d33">
        {TENTACLES.map((d, i) => (
          <path key={i} d={d} style={{ '--i': i }} />
        ))}
      </g>
    </svg>
  );
}
