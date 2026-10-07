// Minecraft, what the crosshair is on: a ray from the eye stepped cell by
// cell (Amanatides and Woo's voxel walk) to the first block the game lets
// you pick, within the reach (4.5 blocks), and the face it went in by, the
// face a placed block goes against. Air and liquids are passed through;
// everything else, plants, leaves and glass among them, is picked.

import { BLOCKS } from './blocks.js';
import { FACE } from './mesher.js';

export const REACH = 4.5;
const PICK = new Uint8Array(256);
BLOCKS.forEach((b, i) => (PICK[i] = b.shape === 'none' || b.shape === 'liquid' ? 0 : 1));

const NORMALS = [
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, -1],
  [0, 0, 1],
  [1, 0, 0],
  [-1, 0, 0],
];
export const normal = (face) => NORMALS[face];

export function raycast(world, eye, dir, reach = REACH) {
  const len = Math.hypot(dir.x, dir.y, dir.z);
  if (!len) return null;
  const d = [dir.x / len, dir.y / len, dir.z / len];
  const p = [eye.x, eye.y, eye.z];
  const cell = p.map(Math.floor);
  const step = d.map((v) => (v > 0 ? 1 : v < 0 ? -1 : 0));
  // how far along the ray to the next cell boundary on each axis, and between boundaries
  const delta = d.map((v) => (v ? Math.abs(1 / v) : Infinity));
  const next = d.map((v, k) => (v > 0 ? (cell[k] + 1 - p[k]) / v : v < 0 ? (p[k] - cell[k]) / -v : Infinity));
  // the face entered by a step along each axis, by its sign
  const entered = [
    [FACE.west, FACE.east],
    [FACE.bottom, FACE.top],
    [FACE.north, FACE.south],
  ];
  for (;;) {
    const k = next[0] < next[1] ? (next[0] < next[2] ? 0 : 2) : next[1] < next[2] ? 1 : 2;
    const t = next[k];
    if (t >= reach) return null;
    cell[k] += step[k];
    next[k] += delta[k];
    const id = world.get(cell[0], cell[1], cell[2]);
    if (PICK[id]) return { x: cell[0], y: cell[1], z: cell[2], face: entered[k][step[k] > 0 ? 0 : 1], id, t };
  }
}
