// Orthanc, the land: Saruman's great hall at the foot of the tower and the
// library of lore off it; the stair winding up inside the tower; and the
// pinnacle at the top, between the four horns, over the ring of Isengard.
// The hall (with the library) is its own place (`zone` 'hall'); the stair
// and the pinnacle are in the tower, which stands in the middle of
// Isengard ('tower'). ./scene.js draws them apart. No drawing here, so it
// can be tested on its own.
//
// The towns' conventions (../bree/layout.js): metres, +x east, +z south; a
// figure's `face` turns its +x to (cos face, -sin face), so π/2 is north.

import { pushOut, sightClear } from '../walker';

const TAU = Math.PI * 2;
const circle = (id, x, z, r, o = {}) => ({ id, kind: 'circle', x, z, r, ...o });
const box = (id, x, z, w, d, o = {}) => ({ id, kind: 'box', x, z, w, d, turn: 0, ...o });

// ── the great hall ──
// Eight-sided, its faces square to the compass, `A` metres from the middle
// to each face. The great doors are in the south face, the arch to the
// library in the east, the door to the stair in the west; the throne on its
// dais against the north face, the palantír on its pillar before it.
export const A = 14;
export const HALL_H = 26;
const CORNER = A / Math.cos(Math.PI / 8);
export const CORNERS = Array.from({ length: 8 }, (_, k) => {
  const a = (k + 0.5) * (Math.PI / 4);
  return [Math.cos(a) * CORNER, Math.sin(a) * CORNER];
});
// each face is cut in six facets; a way through takes the middle two
export const FACE = 2 * A * Math.tan(Math.PI / 8);
export const ARCH = { x: A, z: 0, w: FACE / 3, h: 7 };
export const DOORS = { x: 0, z: A, w: FACE / 3, h: 10 };
export const STAIR_DOOR = { x: -A, z: 0, w: FACE / 3, h: 5 };
export const HALL_IN = { x: 0, z: A - 4.4, face: Math.PI / 2 };

export const THRONE = { x: 0, z: -12.4 };
export const DAIS = { x: 0, z: -11.7, w: 7.4, d: 3.6, steps: 3, h: 0.9 };
export const PALANTIR = { x: 0, z: -7.2, r: 2.6 };
export const SARUMAN_AT = { x: 1.6, z: -7.9, face: -Math.PI / 2, r: 3.8 };
// eight pillars, one in from each corner
export const PILLARS = Array.from({ length: 8 }, (_, k) => {
  const a = (k + 0.5) * (Math.PI / 4);
  return [Math.cos(a) * 11, Math.sin(a) * 11];
});
export const BRAZIERS = [
  [-5.6, -4.6],
  [5.6, -4.6],
  [-5.6, 6.4],
  [5.6, 6.4],
];
// where the wizards stand to fight, and how far each push drives him back
export const DUEL_AT = { gandalf: { x: -3.6, z: 1.2 }, saruman: { x: 3.6, z: 1.2 }, back: 1.2 };

// ── the library ──
// A long room through the arch, lined with books; two cases stand out
// from its long walls, and the lectern is at the far end. Behind the
// northern case, low down, something Saruman wouldn't want seen.
export const LIB = { x0: A, x1: 24.5, z0: -5, z1: 5, h: 9 };
export const CASES = [box('caseN', 19.4, -3.3, 0.7, 3.4, { top: 5 }), box('caseS', 19.4, 3.3, 0.7, 3.4, { top: 5 })];
export const LECTERN = { x: 23.2, z: 0, r: 1.9 };
export const LEAF = { x: 20.5, z: -4.2, r: 1.1, jar: [19.95, -4.35] };

const faceWalls = () => {
  const out = [];
  for (let k = 0; k < 8; k++) {
    const [x0, z0] = CORNERS[(k + 7) % 8];
    const [x1, z1] = CORNERS[k];
    // the east face (from the corner at -22.5° to the one at 22.5°) has the arch in it
    if (k === 0) {
      out.push([x0, z0, A, -ARCH.w / 2, 0.25], [A, ARCH.w / 2, x1, z1, 0.25]);
    } else out.push([x0, z0, x1, z1, 0.25]);
  }
  return out;
};
export const HALL_WALLS = [
  ...faceWalls(),
  // the library's walls (its shelves' faces)
  [A, LIB.z0, LIB.x1, LIB.z0, 0.2],
  [A, LIB.z1, LIB.x1, LIB.z1, 0.2],
  [LIB.x1, LIB.z0, LIB.x1, LIB.z1, 0.2],
];
export const HALL_COLLIDERS = [
  ...PILLARS.map(([x, z], i) => circle(`pillar${i}`, x, z, 0.95, { top: HALL_H })),
  box('dais', DAIS.x, DAIS.z, DAIS.w, DAIS.d, { top: DAIS.h, low: true }),
  circle('palantir', PALANTIR.x, PALANTIR.z, 0.55, { top: 1.5, low: true }),
  circle('saruman', SARUMAN_AT.x, SARUMAN_AT.z, 0.45, { top: 2 }),
  ...BRAZIERS.map(([x, z], i) => circle(`brazier${i}`, x, z, 0.5, { top: 1.3, low: true })),
  ...CASES,
  circle('lectern', LECTERN.x, LECTERN.z, 0.45, { top: 1.3, low: true }),
];

// inside the hall's eight faces, or the library (less a margin `m`)
export const inHall = (x, z, m = 0) => Math.abs(x) <= A - m && Math.abs(z) <= A - m && (Math.abs(x) + Math.abs(z)) / Math.SQRT2 <= A - m;
export const inLibrary = (x, z, m = 0) => x >= LIB.x0 - 0.5 && x <= LIB.x1 - m && z >= LIB.z0 + m && z <= LIB.z1 - m;
export const indoors = (x, z, m = 0) => inHall(x, z, m) || inLibrary(x, z, m);
// can the camera at (bx, bz) see someone at (ax, az), or is a wall (or a
// case of books) between?
export const clearView = (ax, az, bx, bz) => sightClear(ax, az, bx, bz, CASES, HALL_WALLS);

// ── the tower ──
// Orthanc in the middle of Isengard: the plain at y = 0, the pinnacle's
// floor `TOWER_H` up. The stair winds up a shaft in the top of it, round a
// middle column, and comes out on the pinnacle at the south.
export const TOWER_H = 120;
export const STAIR = { r: 3.1, rise: 7.2, turns: 3.5, wall: 5.2 };
export const STAIR_BASE = TOWER_H - STAIR.rise * STAIR.turns - 1;
export const STAIR_LEN = STAIR.turns * Math.hypot(TAU * STAIR.r, STAIR.rise);
// it starts at the north and, three and a half turns up, comes out at the south
const A0 = 1.5 * Math.PI;
export const stairAngle = (s) => A0 + (Math.max(0, Math.min(STAIR_LEN, s)) / STAIR_LEN) * STAIR.turns * TAU;
// the point `s` metres up the stair, [x, y, z]
export function stairAt(s) {
  const k = Math.max(0, Math.min(1, s / STAIR_LEN));
  const a = stairAngle(s);
  return [Math.cos(a) * STAIR.r, STAIR_BASE + k * STAIR.turns * STAIR.rise, Math.sin(a) * STAIR.r];
}
// the way the stair climbs there, as a figure's `face`
export const stairFace = (s) => {
  const a = stairAngle(s);
  return Math.atan2(-Math.cos(a), -Math.sin(a));
};
// the windows on the way up, by how far up the stair: each looks out over
// Isengard at something Saruman wants you to see
export const WINDOWS = [14, 32, 50];
export const WINDOW_SIGHTS = ['felled', 'pits', 'host'];

// ── the pinnacle ──
// A floor of black stone between four horns, `r` metres you can walk from
// the middle, with nothing round its edge. The stair comes up through it at
// the south; the moth comes to the north edge, and Gwaihir from the north.
export const PIN = { r: 4, horns: 6.2 };
export const PIN_IN = { x: 0, z: 2, face: Math.PI / 2 };
export const MOTH_AT = { x: 0, z: -3.1, r: 1.6 };
export const HORNS = [0.25, 0.75, 1.25, 1.75].map((k) => [Math.cos(k * Math.PI) * PIN.horns, Math.sin(k * Math.PI) * PIN.horns]);

// ── Isengard ──
// The ring wall round the plain, its one gate in the south, and the pits
// where the trees once grew, glowing.
export const RING = { r: 235, gate: Math.PI / 2 };
export const PITS = (() => {
  // scattered, but not too near the tower or each other
  let s = 1777;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const out = [];
  for (let tries = 0; out.length < 26 && tries < 2000; tries++) {
    const a = rand() * TAU;
    const r = 45 + Math.sqrt(rand()) * 160;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const size = 4 + rand() * 5;
    if (out.some((p) => Math.hypot(p.x - x, p.z - z) < p.size + size + 10)) continue;
    out.push({ x, z, size });
  }
  return out;
})();
// where the Uruk-hai stand mustered, in ranks, south of the tower
export const HOST = { x: 0, z: 70, rows: 10, files: 16, gap: 1.6 };

// A saved spot, if it's fair (only the hall and the pinnacle are saved).
export function validAt(saved, zone) {
  const start = zone === 'top' ? PIN_IN : HALL_IN;
  const back = { zone, ...start };
  if (!saved || saved.zone !== zone || !Number.isFinite(saved.x) || !Number.isFinite(saved.z)) return back;
  if (zone === 'top') {
    if (Math.hypot(saved.x, saved.z) > PIN.r) return back;
  } else {
    if (!indoors(saved.x, saved.z, 0.3)) return back;
    const [x, z] = pushOut(saved.x, saved.z, 0.4, HALL_COLLIDERS, HALL_WALLS);
    if (Math.hypot(x - saved.x, z - saved.z) > 0.05) return back;
  }
  return { zone, x: saved.x, z: saved.z, face: Number.isFinite(saved.face) ? saved.face : start.face };
}
