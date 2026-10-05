// The Avengers compound's plan, shared by the drawing (../Compound.jsx) and
// the 3D view (./scene.js): plan coordinates are x east, y south, z up, in
// units of about four metres; P projects them as the drawing does (a true
// isometric view, which the 3D camera matches).

export const VW = 720;
export const VH = 480;
export const K = 3.15;
export const C = Math.cos(Math.PI / 6);
export const OX = 372;
export const OY = 34;
export const P = (x, y, z = 0) => [OX + (x - y) * C * K, OY + ((x + y) * 0.5 - z) * K];

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ── The plan ────────────────────────────────────────────────────────────────
export const HANGAR = [[6, 16], [30, 16], [30, 66], [6, 66]];
export const APRON = [[2, 68], [34, 68], [36.5, 80], [31, 92], [17, 97], [4.5, 91], [0, 80]];
export const PROW = [[44, 19.4], [59.8, 19.9], [60.65, 31.9], [44.6, 32.4]];
export const CRES = { cx: 58, cy: -6, rIn: 26, rOut: 38, a0: (20 * Math.PI) / 180, a1: (86 * Math.PI) / 180, h: 11.6, n: 14 };
export const TRAINING = [[96, 16], [122, 13], [124, 31], [98, 34]];
export const LAB = [[80, 70], [104, 68], [106, 86], [82, 88]];
export const GATE = [[38, 98], [46, 97.5], [46.4, 102], [38.4, 102.5]];
export const BRIDGE = [[30, 24.6], [44, 24.2], [44, 27.6], [30, 28]];
export const BERM = [[-18, 13], [-6, 13], [-6, 16], [-18, 16]];
export const STALLS = [[-18, 64], [-6, 64], [-6, 68], [-18, 68]];
export const LAWN = [[-26, 6], [6, 0], [40, -4], [72, -6], [100, -4], [126, 4], [140, 30], [140, 70], [126, 98], [90, 110], [50, 112], [10, 110], [-22, 98], [-30, 60]];
export const SHORE = [[-120, -46], [-40, -30], [10, -18], [44, -12], [76, -11], [102, -6], [128, 3], [146, 14], [166, 32], [196, 64], [240, 110]];
export const RIVER = [...SHORE, [260, 110], [260, -220], [-120, -220]];

export const arcPt = (r, a) => [CRES.cx + r * Math.cos(a), CRES.cy + r * Math.sin(a)];
export const CRES_FOOT = (() => {
  const out = [];
  for (let i = 0; i <= CRES.n; i++) out.push(arcPt(CRES.rOut, CRES.a0 + ((CRES.a1 - CRES.a0) * i) / CRES.n));
  for (let i = CRES.n; i >= 0; i--) out.push(arcPt(CRES.rIn, CRES.a0 + ((CRES.a1 - CRES.a0) * i) / CRES.n));
  return out;
})();

// where each part of the tour is, as a point on (or above) the plan
export const SPOTS = {
  stark: [84, 12, 13.5],
  thor: [56, 62, 0.5],
  cap: [110, 23, 9],
  hawkeye: [-12, 40, 0.5],
  widow: [52, 26, 15],
  banner: [93, 78, 8],
  spidey: [42, 100, 3],
  vault: [18, 40, 10.5],
};

export const depthOf = (foot) => (2 * foot.reduce((sum, [x, y]) => sum + x + y, 0)) / foot.length;
// nothing grows on the buildings, the pads or the track
export const CLEAR = [
  [4, 14, 32, 98],
  [42, -12, 96, 34],
  [94, 11, 126, 36],
  [78, 66, 108, 90],
  [36, 95, 74, 107],
  [-20, 11, -4, 70],
  [60, 42, 80, 62],
  [96, 44, 128, 64],
];
export const clear = (x, y, r) => CLEAR.some(([x0, y0, x1, y1]) => x > x0 - r && x < x1 + r && y > y0 - r && y < y1 + r);

export const inPoly = (x, y, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
export const onScreen = (x, y, m = 20) => {
  const [sx, sy] = P(x, y, 3);
  return sx > -m && sx < VW + m && sy > -m && sy < VH + m;
};

// trees: a ring of them along the edge of the woods, then lines along the drives
export const TREES = (() => {
  const rand = rng(7);
  const out = [];
  for (let i = 0; i < LAWN.length; i++) {
    const a = LAWN[i];
    const b = LAWN[(i + 1) % LAWN.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = (b[1] - a[1]) / len;
    const ny = (a[0] - b[0]) / len;
    for (let d = 0; d < len; d += 3.2 + rand() * 2.4) {
      const k = d / len;
      const off = 1 + rand() * 4;
      const x = a[0] + (b[0] - a[0]) * k + nx * off;
      const y = a[1] + (b[1] - a[1]) * k + ny * off;
      const r = 2.6 + rand() * 1.4;
      if (inPoly(x, y, RIVER) || !onScreen(x, y) || clear(x, y, r)) continue;
      out.push({ x, y, r, tone: rand() });
    }
  }
  // a second, looser row further into the woods
  for (let i = 0; i < 160; i++) {
    const x = -120 + rand() * 330;
    const y = -60 + rand() * 230;
    if (inPoly(x, y, LAWN) || inPoly(x, y, RIVER) || !onScreen(x, y)) continue;
    out.push({ x, y, r: 2.8 + rand() * 1.6, tone: rand() });
  }
  // the drives
  const lines = [
    [[-30, 96], [-4, 94]],
    [[64, 92], [66, 70]],
    [[84, 98], [116, 92]],
    [[131, 38], [133, 70]],
    [[-1, 14], [1, 60]],
    [[38, 40], [38, 64]],
  ];
  for (const [a, b] of lines) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let d = 0; d <= len; d += 6) {
      const x = a[0] + ((b[0] - a[0]) * d) / len;
      const y = a[1] + ((b[1] - a[1]) * d) / len;
      const r = 1.8 + rand() * 0.5;
      if (!clear(x, y, r)) out.push({ x, y, r, tone: 0.7 + rand() * 0.3 });
    }
  }
  return out;
})();

// the drives, as SVG paths in plan coordinates
export const ROADS = [
  'M-70 106 L30 100 C48 99 56 92 60 80 C64 68 56 60 52 50 C49 42 50 37 54 35.5',
  'M60 80 C70 76 84 74 88 66 C92 58 90 44 82 38',
  'M30 100 C32 97 34 94 34 89',
  'M88 66 C96 64 100 62 102 60 C108 52 108 44 104 37',
  'M82 38 C88 36 92 36 96 35',
  'M-8 66 L-2 70 C2 72 4 76 4 80',
];
