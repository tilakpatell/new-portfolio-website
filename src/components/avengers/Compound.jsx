import { memo } from 'react';
import { APRON, arcPt, BERM, BRIDGE, C, CRES, CRES_FOOT, depthOf, GATE, HANGAR, K, LAB, LAWN, OX, OY, P, PROW, RIVER, ROADS, SHORE, SPOTS, STALLS, TRAINING, TREES, VH, VW } from './compound/plan';

// The Avengers compound in upstate New York, from the air, in isometric: the
// long hangar with the A on its roof and solar panels, the landing pad with two
// Quinjets, the main building (a grey prow with the A on it, and a curved glass
// wing banded with white floor slabs), the helipad, a running track by the
// training center, the lab, the range, the gatehouse, roads through mown lawn,
// woods all round and the river along one side.
//
// Everything is built from plan coordinates (x east, y south, z up, in units
// of about four meters) and projected, so faces, shadows and paint on roofs and
// walls all line up. The static drawing is one SVG; the moving parts (a Quinjet
// flying over, the river's shimmer, the pins) are a second SVG laid over it, so
// animating them never repaints the woods.

const r1 = (v) => Math.round(v * 10) / 10;
const r4 = (v) => Math.round(v * 10000) / 10000;
const pts = (list) => list.map(([x, y]) => `${r1(x)},${r1(y)}`).join(' ');
const ground = (z = 0) => `matrix(${r4(C * K)} ${r4(0.5 * K)} ${r4(-C * K)} ${r4(0.5 * K)} ${r1(OX)} ${r1(OY - z * K)})`;
// A wall's own frame: u runs from a to b along the wall, w runs down from height h.
function wallFrame(a, b, h) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / L;
  const uy = (b[1] - a[1]) / L;
  const [ex, ey] = P(a[0], a[1], h);
  return { L, m: `matrix(${r4(C * K * (ux - uy))} ${r4(0.5 * K * (ux + uy))} 0 ${r4(K)} ${r1(ex)} ${r1(ey)})` };
}

// light from the south-west, high: south faces lit, east faces in shade, shadows to the north-east
const LX = -0.55;
const LY = 0.85;
const SHADOW = [0.55, -0.85];
const lightOf = (nx, ny) => {
  const n = Math.hypot(nx, ny) * Math.hypot(LX, LY);
  return Math.max(0, Math.min(1, ((nx * LX + ny * LY) / n + 1) / 2));
};
const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;

const MAT = {
  white: { top: '#f3f4f5', lit: [238, 241, 244], shade: [146, 156, 169] },
  grey: { top: '#cfd4da', lit: [182, 190, 200], shade: [98, 108, 122] },
  glass: { top: '#e2e6ea', lit: [104, 136, 170], shade: [36, 52, 74] },
  earth: { top: '#a79770', lit: [168, 150, 110], shade: [110, 96, 68] },
  asphalt: { top: '#50565d', lit: [92, 98, 106], shade: [52, 56, 62] },
};

// the visible walls of a prism (footprint clockwise, as seen from above), back to front
function walls(foot, z0, z1) {
  const out = [];
  for (let i = 0; i < foot.length; i++) {
    const a = foot[i];
    const b = foot[(i + 1) % foot.length];
    const nx = b[1] - a[1];
    const ny = a[0] - b[0];
    if (nx + ny <= 0.001) continue;
    out.push({ a, b, nx, ny, t: lightOf(nx, ny), depth: a[0] + a[1] + b[0] + b[1], quad: [P(a[0], a[1], z0), P(b[0], b[1], z0), P(b[0], b[1], z1), P(a[0], a[1], z1)] });
  }
  return out.sort((p, q) => p.depth - q.depth);
}
const top = (foot, z) => foot.map(([x, y]) => P(x, y, z));

function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper = [];
  for (const q of p.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
const shadowOf = (foot, h, z0 = 0) => {
  const d = h * 0.7;
  const lift = z0 * 0.7;
  return hull([...foot.map(([x, y]) => [x + SHADOW[0] * lift, y + SHADOW[1] * lift]), ...foot.map(([x, y]) => [x + SHADOW[0] * d, y + SHADOW[1] * d])]);
};

const TREE_COLORS = [
  ['#2f5a2f', '#3f7440'],
  ['#36633a', '#4a8247'],
  ['#3d6b34', '#56893f'],
  ['#2b5233', '#3b6c45'],
];

// ── Pieces ──────────────────────────────────────────────────────────────────
function Faces({ foot, z0 = 0, z1, mat, children }) {
  const m = MAT[mat];
  return (
    <g>
      {walls(foot, z0, z1).map((w, i) => (
        <polygon key={i} points={pts(w.quad)} fill={mix(m.shade, m.lit, w.t)} />
      ))}
      <polygon points={pts(top(foot, z1))} fill={m.top} />
      {children}
    </g>
  );
}

// the Avengers A in a ring, in a 40 × 40 box
function AvengersA({ color, ring = 2.6, x = 0, y = 0, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="none" stroke={color} strokeLinejoin="round">
      <circle cx="20" cy="20" r="14.5" strokeWidth={ring} />
      <path d="M9.5 35 L21.5 4.5" strokeWidth="4.6" strokeLinecap="square" />
      <path d="M21.5 4.5 L27.8 21" strokeWidth="3" />
      <path d="M12 23.6 H31 M31 19.8 L37.6 23.6 L31 27.4 Z" strokeWidth="3" fill={color} />
    </g>
  );
}

function Quinjet({ x, y, z, angle = 0, shadow = true, scale = 1 }) {
  const body = (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}>
      <path d="M1.4 -0.6 L6.6 2.4 L6.8 3.5 L1.6 2.7 Z M-1.4 -0.6 L-6.6 2.4 L-6.8 3.5 L-1.6 2.7 Z" fill="#3a414c" stroke="#7d8898" strokeWidth="0.12" />
      <path d="M1.3 3.4 L3.7 5.9 L3.6 6.4 L1.2 5.3 Z M-1.3 3.4 L-3.7 5.9 L-3.6 6.4 L-1.2 5.3 Z" fill="#323842" />
      <path d="M0 -6.6 C0.9 -5.7 1.5 -3.7 1.6 -1.5 L1.7 3.7 L0.9 5.7 L-0.9 5.7 L-1.7 3.7 L-1.6 -1.5 C-1.5 -3.7 -0.9 -5.7 0 -6.6 Z" fill="#444c58" stroke="#8a95a5" strokeWidth="0.12" />
      <path d="M0 -5.4 C0.6 -4.7 0.8 -3.7 0.75 -2.7 L-0.75 -2.7 C-0.8 -3.7 -0.6 -4.7 0 -5.4 Z" fill="#1b2533" />
      <path d="M-0.2 -4.8 L0.25 -4.2" stroke="#7fa8d6" strokeWidth="0.25" />
      <path d="M1.5 -0.4 L6.5 2.5 M-1.5 -0.4 L-6.5 2.5" stroke="#9aa6b5" strokeWidth="0.18" />
    </g>
  );
  return (
    <g>
      {shadow && (
        <g transform={ground(Math.max(0, z - 1.4))} opacity="0.28">
          <g transform={`translate(${SHADOW[0] * 1.2} ${SHADOW[1] * 1.2})`}>
            <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}>
              <path d="M0 -6.6 C1 -5.6 1.6 -3.6 1.7 -1.5 L6.8 2.4 L6.9 3.6 L1.7 2.8 L3.7 6.4 L-3.7 6.4 L-1.7 2.8 L-6.9 3.6 L-6.8 2.4 L-1.7 -1.5 C-1.6 -3.6 -1 -5.6 0 -6.6 Z" fill="#000" />
            </g>
          </g>
        </g>
      )}
      <g transform={ground(z)}>{body}</g>
    </g>
  );
}

function Tree({ t, detail }) {
  const [sx, sy] = P(t.x, t.y, t.r * 0.9 + 0.8);
  const rs = t.r * K * 0.92;
  const [base, light] = TREE_COLORS[Math.floor(t.tone * TREE_COLORS.length) % TREE_COLORS.length];
  return (
    <g>
      <g transform={ground(0)}>
        <ellipse cx={t.x + SHADOW[0] * t.r * 1.1} cy={t.y + SHADOW[1] * t.r * 1.1} rx={t.r * 1.05} ry={t.r * 1.05} fill="#0d1a0c" opacity="0.28" />
      </g>
      <circle cx={r1(sx)} cy={r1(sy)} r={r1(rs)} fill={base} />
      {detail && <circle cx={r1(sx - rs * 0.28)} cy={r1(sy - rs * 0.32)} r={r1(rs * 0.6)} fill={light} />}
    </g>
  );
}

// the curved wing: glass between white slabs, a little proud of the glass
function Crescent() {
  const { h, n, rOut, a0, a1 } = CRES;
  const segs = [];
  for (let i = 0; i < n; i++) {
    const aa = a0 + ((a1 - a0) * i) / n;
    const ab = a0 + ((a1 - a0) * (i + 1)) / n;
    const pa = arcPt(rOut, aa);
    const pb = arcPt(rOut, ab);
    const nx = pb[1] - pa[1];
    const ny = pa[0] - pb[0];
    if (nx + ny <= 0) continue;
    segs.push({ aa, ab, pa, pb, t: lightOf(nx, ny) });
  }
  const slabs = [0, 3.7, 7.5, 11.0];
  const out = (r) => (a) => arcPt(r, a);
  const o2 = out(rOut + 0.7);
  return (
    <g>
      {segs.map((s, i) => (
        <g key={i}>
          <polygon points={pts([P(...s.pa, 0), P(...s.pb, 0), P(...s.pb, h), P(...s.pa, h)])} fill="url(#hq-glass)" />
          <polygon points={pts([P(...s.pa, 0), P(...s.pb, 0), P(...s.pb, h), P(...s.pa, h)])} fill="#06101c" opacity={r1((1 - s.t) * 0.55)} />
          <path d={`M${pts([P(...s.pa, 0.4)])} L${pts([P(...s.pa, h - 0.4)])}`} stroke="#dbe6f2" strokeOpacity="0.35" strokeWidth="0.7" />
          {slabs.map((z) => {
            const qa = o2(s.aa);
            const qb = o2(s.ab);
            const face = mix([150, 160, 172], [244, 246, 248], s.t);
            return (
              <g key={z}>
                <polygon points={pts([P(...qa, z), P(...qb, z), P(...qb, z + 0.6), P(...qa, z + 0.6)])} fill={face} />
                <polygon points={pts([P(...s.pa, z + 0.6), P(...s.pb, z + 0.6), P(...qb, z + 0.6), P(...qa, z + 0.6)])} fill="#f7f8f9" />
              </g>
            );
          })}
        </g>
      ))}
      <polygon points={pts(top(CRES_FOOT, h + 0.6))} fill="#dfe3e7" />
      <polyline points={pts(CRES_FOOT.slice(0, n + 1).map(([x, y]) => P(x, y, h + 0.6)))} fill="none" stroke="#ffffff" strokeWidth="1.2" />
      {[0.25, 0.5, 0.75].map((k) => {
        const a = a0 + (a1 - a0) * k;
        const [x, y] = arcPt((CRES.rIn + CRES.rOut) / 2, a);
        return <Faces key={k} foot={[[x - 1.6, y - 1.2], [x + 1.6, y - 1.2], [x + 1.6, y + 1.2], [x - 1.6, y + 1.2]]} z0={h + 0.6} z1={h + 1.7} mat="grey" />;
      })}
    </g>
  );
}

function Prow() {
  const h = 13;
  const face = wallFrame(PROW[3], PROW[2], h);
  return (
    <Faces foot={PROW} z1={h} mat="grey">
      <g transform={face.m}>
        {Array.from({ length: 10 }, (_, i) => (
          <path key={i} d={`M0 ${r1(1.25 * (i + 1))} H${r1(face.L)}`} stroke="#ffffff" strokeOpacity="0.28" strokeWidth="0.1" />
        ))}
        <AvengersA color="#e8edf2" ring={2.6} x={face.L / 2 - 4.05 + 0.18} y={2.15 + 0.18} s={0.2} />
        <AvengersA color="#3a424d" ring={2.6} x={face.L / 2 - 4.05} y={2.15} s={0.2} />
      </g>
      <polygon points={pts(top([[45, 20.4], [59, 20.9], [59.7, 30.9], [45.6, 31.4]], h))} fill="none" stroke="#b9c0c8" strokeWidth="0.8" />
    </Faces>
  );
}

function Hangar() {
  const h = 9;
  const east = wallFrame(HANGAR[2], HANGAR[1], h);
  const south = wallFrame(HANGAR[3], HANGAR[2], h);
  return (
    <Faces foot={HANGAR} z1={h} mat="white">
      <g transform={east.m}>
        <rect x="1.5" y="1.2" width={east.L - 3} height="1.7" fill="#3c5573" />
        <rect x={east.L - 20} y="4.4" width="18" height="4.6" fill="#466284" />
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d={`M${2 + i * 4} 0 V${h}`} stroke="#7f8a96" strokeOpacity="0.35" strokeWidth="0.18" />
        ))}
      </g>
      <g transform={south.m}>
        <rect x="3" y="2.3" width="18" height={h - 2.3} fill="#aab2bc" />
        {Array.from({ length: 8 }, (_, i) => (
          <path key={i} d={`M${3 + (i + 1) * 2} 2.3 V${h}`} stroke="#7d8692" strokeWidth="0.15" />
        ))}
      </g>
      <g transform={ground(h)}>
        <rect x="7.2" y="17.2" width="21.6" height="47.6" fill="none" stroke="#d3d8dd" strokeWidth="0.5" />
        {Array.from({ length: 5 }, (_, i) => (
          <g key={i}>
            <rect x="9.5" y={19 + i * 6.6} width="7.6" height="4.8" fill="#2d4a6b" />
            <rect x="18.9" y={19 + i * 6.6} width="7.6" height="4.8" fill="#2d4a6b" />
            <path d={`M9.5 ${21.4 + i * 6.6} H17.1 M18.9 ${21.4 + i * 6.6} H26.5 M13.3 ${19 + i * 6.6} V${23.8 + i * 6.6} M22.7 ${19 + i * 6.6} V${23.8 + i * 6.6}`} stroke="#5b7ea6" strokeWidth="0.15" />
          </g>
        ))}
        <AvengersA color="#59616b" ring={2.4} x={18 - 6.2} y={58.2 - 6.2} s={0.31} />
      </g>
    </Faces>
  );
}

// ── The static drawing ──────────────────────────────────────────────────────
const Base = memo(function Base({ compact }) {
  const buildings = [
    { depth: depthOf(HANGAR), el: <Hangar key="hangar" /> },
    { depth: depthOf(BRIDGE), el: (
      <g key="bridge">
        <Faces foot={[[36.6, 25.6], [37.6, 25.6], [37.6, 26.6], [36.6, 26.6]]} z1={4.6} mat="grey" />
        <Faces foot={BRIDGE} z0={4.6} z1={7} mat="glass" />
      </g>
    ) },
    { depth: depthOf(PROW), el: <Prow key="prow" /> },
    { depth: depthOf(CRES_FOOT), el: <Crescent key="cres" /> },
    { depth: depthOf(TRAINING), el: (
      <Faces key="training" foot={TRAINING} z1={7} mat="white">
        <Faces foot={[[100, 21], [119, 19], [120, 24], [101, 26]]} z0={7} z1={8.4} mat="glass" />
      </Faces>
    ) },
    { depth: depthOf(LAB), el: (
      <Faces key="lab" foot={LAB} z1={6} mat="white">
        {[0, 1, 2].map((k) => (
          <Faces key={k} foot={[[84, 72.5 + k * 5], [101.5, 71 + k * 5], [101.7, 72.6 + k * 5], [84.2, 74.1 + k * 5]]} z0={6} z1={7.2} mat="glass" />
        ))}
      </Faces>
    ) },
    { depth: depthOf(GATE), el: (
      <Faces key="gate" foot={GATE} z1={3.2} mat="white">
        {walls(GATE, 2.5, 3.2).map((w, i) => (
          <polygon key={i} points={pts(w.quad)} fill={mix([120, 30, 30], [196, 58, 52], w.t)} />
        ))}
      </Faces>
    ) },
    { depth: depthOf(BERM), el: <Faces key="berm" foot={BERM} z1={2.2} mat="earth" /> },
    { depth: depthOf(STALLS), el: <Faces key="stalls" foot={STALLS} z1={3} mat="white" /> },
  ];
  const trees = (compact ? TREES.filter((_, i) => i % 2 === 0) : TREES).map((t, i) => ({ depth: (t.x + t.y) * 2, el: <Tree key={`t${i}`} t={t} detail={!compact} /> }));
  const scene = [...buildings, ...trees].sort((a, b) => a.depth - b.depth);
  const shadows = [
    shadowOf(HANGAR, 9),
    shadowOf(PROW, 13),
    shadowOf(CRES_FOOT, 12.2),
    shadowOf(TRAINING, 8.4),
    shadowOf(LAB, 7.2),
    shadowOf(GATE, 3.2),
    shadowOf(BERM, 2.2),
    shadowOf(STALLS, 3),
    shadowOf(BRIDGE, 7, 4.6),
  ];
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="hq-base" aria-hidden="true">
      <defs>
        <linearGradient id="hq-water" gradientUnits="userSpaceOnUse" x1="60" y1="-10" x2="140" y2="-90">
          <stop offset="0" stopColor="#6f8f8f" />
          <stop offset="1" stopColor="#4d6f7a" />
        </linearGradient>
        <linearGradient id="hq-glass" gradientUnits="userSpaceOnUse" x1="0" y1="60" x2="0" y2="150">
          <stop offset="0" stopColor="#a9c4df" />
          <stop offset="0.45" stopColor="#5f80a5" />
          <stop offset="1" stopColor="#2d4260" />
        </linearGradient>
        <pattern id="hq-woods" width="58" height="40" patternUnits="userSpaceOnUse">
          <rect width="58" height="40" fill="#2c4a2b" />
          {[
            [6, 6, 8, 0],
            [22, 3, 9, 1],
            [40, 8, 8.5, 2],
            [54, 2, 7, 3],
            [13, 21, 9, 2],
            [31, 22, 8, 0],
            [48, 25, 9, 1],
            [4, 36, 8, 3],
            [24, 38, 8.5, 1],
            [42, 40, 8, 2],
            [62, 6, 8.5, 2],
            [-4, 2, 7, 3],
            [58, 36, 8, 0],
            [0, 21, 6.5, 0],
            [60, 22, 7, 1],
          ].map(([x, y, r, c], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={r} fill={TREE_COLORS[c][0]} />
              <circle cx={x - r * 0.3} cy={y - r * 0.32} r={r * 0.55} fill={TREE_COLORS[c][1]} opacity="0.85" />
            </g>
          ))}
        </pattern>
        <pattern id="hq-woods-b" width="83" height="61" patternUnits="userSpaceOnUse" patternTransform="translate(17 11)">
          {[
            [10, 12, 10, 3],
            [44, 30, 11, 2],
            [70, 8, 9, 0],
            [28, 52, 10, 1],
            [64, 50, 9, 3],
            [88, 30, 8, 1],
            [-6, 40, 9, 2],
          ].map(([x, y, r, c], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={r} fill={TREE_COLORS[c][0]} />
              <circle cx={x - r * 0.3} cy={y - r * 0.32} r={r * 0.55} fill={TREE_COLORS[c][1]} opacity="0.8" />
              <circle cx={x + r * 0.25} cy={y + r * 0.35} r={r * 0.5} fill="#1f3a20" opacity="0.35" />
            </g>
          ))}
        </pattern>
        <clipPath id="hq-lawn-clip">
          <polygon points={pts(LAWN)} />
        </clipPath>
      </defs>

      <rect width={VW} height={VH} fill="url(#hq-woods)" />
      <rect width={VW} height={VH} fill="url(#hq-woods-b)" opacity="0.8" />

      <g transform={ground(0)}>
        {/* the river, its bank, the lawn and its mowing stripes */}
        <polygon points={pts(RIVER)} fill="url(#hq-water)" />
        <polyline points={pts(SHORE)} fill="none" stroke="#a69f84" strokeWidth="2.4" strokeLinejoin="round" />
        <polyline points={pts(SHORE.map(([x, y]) => [x - 0.8, y - 1.2]))} fill="none" stroke="#5f7f80" strokeWidth="0.8" opacity="0.7" />
        <polygon points={pts(LAWN)} fill="#86ae5d" />
        <g clipPath="url(#hq-lawn-clip)">
          {Array.from({ length: 22 }, (_, i) => (
            <rect key={i} x="-40" y={-10 + i * 6} width="200" height="3" fill="#94bb69" opacity="0.6" />
          ))}
        </g>

        {/* roads and the parking by the gate */}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {ROADS.map((d, i) => (
            <g key={i}>
              <path d={d} stroke="#848a83" strokeWidth="4.6" />
              <path d={d} stroke="#c6c9c2" strokeWidth="3.7" />
            </g>
          ))}
        </g>
        <rect x="50" y="97" width="22" height="8.4" fill="#9fa39d" />
        {Array.from({ length: 10 }, (_, i) => (
          <path key={i} d={`M${51 + i * 2.2} 97 V100.6 M${51 + i * 2.2} 101.8 V105.4`} stroke="#ffffff" strokeWidth="0.15" />
        ))}
        {[
          [52, 97.6, '#c0392b'],
          [56.4, 97.6, '#f2f2f2'],
          [62.9, 97.6, '#22304a'],
          [65.1, 101.9, '#8a949e'],
          [53.1, 101.9, '#f2f2f2'],
        ].map(([x, y, c], i) => (
          <rect key={i} x={x} y={y} width="1.6" height="2.8" rx="0.4" fill={c} />
        ))}

        {/* the helipad, the running track, the range */}
        <circle cx="70" cy="52" r="8.6" fill="#cfd2cb" stroke="#a5a9a1" strokeWidth="0.4" />
        <circle cx="70" cy="52" r="7" fill="none" stroke="#e0b53a" strokeWidth="0.5" />
        <path d="M67.6 48.6 V55.4 M72.4 48.6 V55.4 M67.6 52 H72.4" stroke="#ffffff" strokeWidth="0.9" />
        <rect x="98" y="46" width="28" height="16" rx="8" fill="#c4573e" />
        <rect x="99.7" y="47.7" width="24.6" height="12.6" rx="6.3" fill="none" stroke="#f2d6cc" strokeWidth="0.14" />
        <rect x="101.3" y="49.3" width="21.4" height="9.4" rx="4.7" fill="#7fab58" />
        <rect x="-18" y="16" width="12" height="48" fill="#d6c79f" />
        <path d="M-14 16 V64 M-10 16 V64" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="0.2" />

        {/* shadows of everything that stands up */}
        <g fill="#0d1a10" opacity="0.26">
          {shadows.map((s, i) => (
            <polygon key={i} points={pts(s)} />
          ))}
        </g>
      </g>

      {/* the landing pad and its Quinjets */}
      <Faces foot={APRON} z1={0.8} mat="asphalt" />
      <g transform={ground(0.8)}>
        <path d="M18 68.5 V75" stroke="#e0b53a" strokeWidth="0.35" strokeDasharray="1 0.8" />
        <circle cx="12" cy="80" r="5.4" fill="none" stroke="#e0b53a" strokeWidth="0.4" />
        <circle cx="26" cy="84" r="5.4" fill="none" stroke="#e0b53a" strokeWidth="0.4" />
      </g>
      <Quinjet x={12} y={80} z={2.2} angle={-22} />
      <Quinjet x={26} y={84} z={2.2} angle={14} />

      {/* the targets at the end of the range */}
      {[-16, -12, -8].map((x) => {
        const [sx, sy] = P(x, 16.4, 1.4);
        return (
          <g key={x}>
            <circle cx={r1(sx)} cy={r1(sy)} r="3.4" fill="#f4f1e6" stroke="#5b4a2e" strokeWidth="0.6" />
            <circle cx={r1(sx)} cy={r1(sy)} r="1.5" fill="#c43b2b" />
          </g>
        );
      })}

      {scene.map((s) => s.el)}

      {/* a little haze over the far woods */}
      <rect width={VW} height={VH} fill="url(#hq-haze)" />
      <defs>
        <linearGradient id="hq-haze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dfe8ea" stopOpacity="0.28" />
          <stop offset="0.35" stopColor="#dfe8ea" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
});

// ── The moving parts, and the pins ──────────────────────────────────────────
const FLY = (() => {
  const a = P(60, 200, 0);
  const b = P(60, -130, 0);
  return [r1(b[0] - a[0]), r1(b[1] - a[1])];
})();

function Pin({ id, n, current, onPick, title, stone }) {
  const [x, y, z] = SPOTS[id];
  const [sx, sy] = P(x, y, z);
  // the size comes from CSS (--ps), so a phone can have bigger pins
  return (
    <g
      className="hq-pin"
      data-on={current || undefined}
      data-pick={onPick ? '' : undefined}
      style={{ '--px': `${r1(sx)}px`, '--py': `${r1(sy)}px` }}
      onClick={onPick ? () => onPick(id) : undefined}
    >
      {title && <title>{title}</title>}
      {current && <circle className="hq-pin-pulse" cx="0" cy="-13.5" r="9" />}
      {stone && <circle className="hq-pin-stone" cx="0" cy="-13.5" r="9.4" style={{ '--glow': stone }} />}
      <path d="M0 0 C-2.6 -4.6 -7 -8.4 -7 -13.5 A7 7 0 1 1 7 -13.5 C7 -8.4 2.6 -4.6 0 0 Z" className="hq-pin-body" />
      <text x="0" y="-10.4" textAnchor="middle" className="hq-pin-num">
        {n}
      </text>
    </g>
  );
}

// The compound walked in 3D is ./world; this is the drawing, for a browser
// without 3D, its pins opening the buildings' games.
export default function Compound({ spots = [], titles = [], current = -1, compact = false, stones = [], onPick, className = '' }) {
  return (
    <div className={`hq-map ${className}`} data-compact={compact || undefined}>
      <Base compact={compact} />
      <svg viewBox={`0 0 ${VW} ${VH}`} className="hq-live" aria-hidden="true">
        {!compact && (
          <>
            <g className="hq-shimmer" transform={ground(0)}>
              {[
                [30, -24, 22],
                [70, -22, 16],
                [104, -16, 20],
                [140, 2, 14],
                [52, -34, 12],
                [120, -24, 18],
              ].map(([x, y, l], i) => (
                <path key={i} d={`M${x} ${y} l${l} ${-l * 0.12}`} stroke="#ffffff" strokeOpacity="0.4" strokeWidth="0.35" strokeLinecap="round" />
              ))}
            </g>
            <g className="hq-fly" style={{ '--fx': `${FLY[0]}px`, '--fy': `${FLY[1]}px` }}>
              <Quinjet x={60} y={200} z={34} scale={1.15} shadow={false} />
            </g>
            <g className="hq-fly hq-fly-shadow" style={{ '--fx': `${FLY[0]}px`, '--fy': `${FLY[1]}px` }}>
              <g transform={ground(0)} opacity="0.22">
                <g transform={`translate(${60 + SHADOW[0] * 24} ${200 + SHADOW[1] * 24}) scale(1.15)`}>
                  <path d="M0 -6.6 C1 -5.6 1.6 -3.6 1.7 -1.5 L6.8 2.4 L6.9 3.6 L1.7 2.8 L3.7 6.4 L-3.7 6.4 L-1.7 2.8 L-6.9 3.6 L-6.8 2.4 L-1.7 -1.5 C-1.6 -3.6 -1 -5.6 0 -6.6 Z" fill="#000" />
                </g>
              </g>
            </g>
          </>
        )}
        {spots.map((id, i) => (
          <Pin key={id} id={id} n={i + 1} current={i === current} onPick={onPick} title={titles[i]} stone={stones[i]} />
        ))}
      </svg>
    </div>
  );
}
