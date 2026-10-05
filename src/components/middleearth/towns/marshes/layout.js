// The Emyn Muil, the Dead Marshes and the Black Gate, the land: three
// small places, each in its own coordinates (`zone` 'emyn', 'marsh',
// 'gate'), drawn apart by ./scene.js. No drawing here, so it can be
// tested on its own.
//
// The towns' conventions (../bree/layout.js): metres, +x east, +z south; a
// figure's `face` turns its +x to (cos face, -sin face).

import { fbm, makeNoise, smooth } from '../../../../lib/paint';
import { pushOut } from '../walker';
import { WAY } from './rules';

const circle = (id, x, z, r, o = {}) => ({ id, kind: 'circle', x, z, r, ...o });
const seeded = (seed) => {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
};
export function toPath(x, z, path) {
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1];
    const [bx, bz] = path[i];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

// ── the Emyn Muil ──
// A hollow under a sheer cliff (its foot along z = cliff), jagged rock all
// round. The rope comes down the face at x = 0; Frodo and Sam sleep at
// its foot, and Gollum comes down the same way.
export const EMYN = { cliff: -12, west: -20, east: 20, south: 16, top: 34 };
export const BED = { x: 1.5, z: EMYN.cliff + 3.5, face: Math.PI / 2 };
export const EMYN_START = { x: 0, z: EMYN.cliff + 4.2, face: Math.PI / 2 };
export const SPIKES = (() => {
  const rand = seeded(13);
  const out = [];
  for (let n = 0; n < 400 && out.length < 18; n++) {
    const x = EMYN.west + rand() * (EMYN.east - EMYN.west);
    const z = EMYN.cliff + 2 + rand() * (EMYN.south - EMYN.cliff - 2);
    if (Math.hypot(x - BED.x, z - BED.z) < 5 || Math.abs(x) < 3.5) continue;
    if (out.some(([ox, oz]) => Math.hypot(x - ox, z - oz) < 4)) continue;
    out.push([x, z, 0.8 + rand() * 1.1, Math.floor(rand() * 1000)]);
  }
  return out;
})();
const emynNoise = makeNoise(17);
export function emynHeight(x, z) {
  let h = (fbm(emynNoise, x * 0.12, z * 0.12, { octaves: 3 }) - 0.5) * 1.2;
  h *= smooth(2, 6, Math.hypot(x - BED.x, z - BED.z));
  // rising to the rim all round, but for the cliff
  const rim = Math.max(smooth(EMYN.east - 6, EMYN.east, Math.abs(x)), smooth(EMYN.south - 6, EMYN.south, z));
  return h + rim * 4;
}
export const EMYN_COLLIDERS = SPIKES.map(([x, z, r], i) => circle(`spike${i}`, x, z, r * 0.8, { top: 3 * r }));
export const EMYN_WALLS = [
  [EMYN.west - 1, EMYN.cliff, EMYN.east + 1, EMYN.cliff, 0.4],
  [EMYN.west, EMYN.cliff, EMYN.west, EMYN.south, 0.4],
  [EMYN.east, EMYN.cliff, EMYN.east, EMYN.south, 0.4],
  [EMYN.west, EMYN.south, EMYN.east, EMYN.south, 0.4],
];

// ── the Dead Marshes ──
// One winding line of firm ground, west to east, through the black pools.
// Off it, you're in the water.
export const MARSH_PATH = [
  [-64, 2],
  [-52, -3],
  [-40, 2],
  [-30, 8],
  [-18, 5],
  [-8, -3],
  [4, -6],
  [16, -1],
  [26, 6],
  [38, 4],
  [50, -2],
  [62, 0],
  [70, 0],
];
export const FIRM = 2.2;
export const MARSH_START = { x: -62, z: 2, face: 0 };
export const onFirm = (x, z) => toPath(x, z, MARSH_PATH) <= FIRM;
export const inMarsh = (x, z) => !onFirm(x, z);
// the candle-lights in the pools, a little off the path: [x, z]
export const LIGHTS = [
  [-47, -3.6],
  [-35, 8],
  [-22, 9],
  [-12, -4.6],
  [1, -8.8],
  [12, 1.6],
  [22, 7.4],
  [33, 1.2],
  [44, 3.6],
  [56, -4.6],
];
// dead trees and reeds, off the path
export const SNAGS = (() => {
  const rand = seeded(31);
  const out = [];
  for (let n = 0; n < 800 && out.length < 28; n++) {
    const x = -70 + rand() * 146;
    const z = -26 + rand() * 52;
    const d = toPath(x, z, MARSH_PATH);
    if (d < FIRM + 1.5 || d > 18) continue;
    if (LIGHTS.some(([lx, lz]) => Math.hypot(x - lx, z - lz) < 2)) continue;
    if (out.some(([ox, oz]) => Math.hypot(x - ox, z - oz) < 3.5)) continue;
    out.push([x, z, Math.floor(rand() * 1000)]);
  }
  return out;
})();
export const MARSH_Y = -0.35;
const marshNoise = makeNoise(29);
export function marshHeight(x, z) {
  const d = toPath(x, z, MARSH_PATH);
  // a low hummock of tussock along the path, mud sinking into the pools
  const firm = 1 - smooth(FIRM - 0.6, FIRM + 1.4, d);
  return -0.9 + firm * 0.8 + (fbm(marshNoise, x * 0.15, z * 0.15, { octaves: 2 }) - 0.5) * 0.3;
}

// ── on the side: Sméagol's safe way ──
// A wide pool north of the path, past halfway across: tussocks in rows
// (`gap` apart) from the bank out to a little island with a dead tree on
// it. A tussock is [col, row]; the bank is where you start, on the path.
export const POOL = { x: 8, z: -6.6, rows: WAY.rows, cols: WAY.cols, gap: 2.1, first: 2.4 };
export const tussockAt = (col, row) => ({ x: POOL.x + (col - (POOL.cols - 1) / 2) * POOL.gap, z: POOL.z - POOL.first - row * POOL.gap });
export const POOL_BANK = { x: POOL.x, z: POOL.z, face: Math.PI / 2 };
export const ISLAND = { x: POOL.x, z: POOL.z - POOL.first - POOL.rows * POOL.gap - 0.6, r: 2 };

// ── before the Black Gate ──
// A slope of ash and rock above the road, rising north (−z). The Gate is
// off to the south-east across the valley, the road running to it.
export const SLOPE = { west: -50, east: 42, north: -24, south: 18 };
export const GATE_AT = { x: 40, z: 150, w: 110 };
export const ROAD = [
  [-120, 46],
  [-40, 50],
  [10, 72],
  [GATE_AT.x, GATE_AT.z - 10],
];
export const SLOPE_START = { x: -44, z: -6, face: 0 };
export const LOOKOUT = { x: 34, z: 6, r: 3 };
const slopeNoise = makeNoise(41);
export function slopeHeight(x, z) {
  // rising to the north, falling away to the road
  let h = smooth(SLOPE.south + 20, SLOPE.north - 10, z) * 18;
  h += (fbm(slopeNoise, x * 0.06, z * 0.06, { octaves: 3 }) - 0.5) * 3;
  return h;
}
// boulders on the slope, for cover: [x, z, r]
export const BOULDERS = [
  [-36, -2, 1.6],
  [-28, -12, 1.4],
  [-22, 6, 1.8],
  [-12, -6, 1.5],
  [-8, 12.2, 1.3],
  [2, -14, 1.6],
  [6, 2, 1.9],
  [14, -6, 1.4],
  [18, 12, 1.5],
  [24, -2, 1.7],
  [-44, 8, 1.4],
  [30, -12, 1.5],
];
export const GATE_COLLIDERS = BOULDERS.map(([x, z, r], i) => circle(`boulder${i}`, x, z, r, { top: 2.4 * r }));
export const GATE_WALLS = [
  [SLOPE.west, SLOPE.north, SLOPE.east, SLOPE.north, 0.4],
  [SLOPE.west, SLOPE.south, SLOPE.east, SLOPE.south, 0.4],
  [SLOPE.west, SLOPE.north, SLOPE.west, SLOPE.south, 0.4],
  [SLOPE.east, SLOPE.north, SLOPE.east, SLOPE.south, 0.4],
];
// the Easterlings' scouts, walking the slope
export const SCOUT_ROUNDS = [
  [
    [-30, 12],
    [-30, -18],
  ],
  [
    [-14, -18],
    [-4, 14],
    [-16, 14],
  ],
  [
    [10, 14],
    [10, -18],
  ],
  [
    [20, -18],
    [28, 14],
  ],
];

// Places to do things
export const SPOTS = [{ zone: 'emyn', id: 'bed', x: BED.x - 1.6, z: BED.z + 1, r: 2.2, quest: 'smeagol' }];

// A saved spot, if it's fair: the zone's own, and out of everything.
export function validAt(saved, zone) {
  const start = zone === 'emyn' ? EMYN_START : zone === 'marsh' ? MARSH_START : SLOPE_START;
  const back = { zone, ...start };
  if (!saved || saved.zone !== zone || !Number.isFinite(saved.x) || !Number.isFinite(saved.z)) return back;
  if (zone === 'marsh' && !onFirm(saved.x, saved.z)) return back;
  const [cs, ws] = zone === 'emyn' ? [EMYN_COLLIDERS, EMYN_WALLS] : zone === 'gate' ? [GATE_COLLIDERS, GATE_WALLS] : [[], []];
  const [x, z] = pushOut(saved.x, saved.z, 0.4, cs, ws);
  if (Math.hypot(x - saved.x, z - saved.z) > 0.05) return back;
  return { zone, x: saved.x, z: saved.z, face: Number.isFinite(saved.face) ? saved.face : 0 };
}
