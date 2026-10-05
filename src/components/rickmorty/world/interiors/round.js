// The round rooms' common kit (Rick's clone lab, Morty's Mind Blowers, the
// Oval Office): the floor, the ceiling and the wall on rules.js's RINGS
// ellipse, drawn on the same 32 runs of wall that stop Morty, with gaps
// where a door is; and where a thing stands against the wall, facing in.

import * as THREE from 'three';

export const RUNS = 32; // as rules.js's ringWalls
const TAU = Math.PI * 2;

// the point at angle `t` round the ring, `inset` metres in from the wall
export const ringAt = (r, t, inset = 0) => ({ x: r.x + (r.a - inset) * Math.cos(t), z: r.z + (r.b - inset) * Math.sin(t) });
// the turn (rules.js's: 0 faces +z) for a thing on the ring at `t` to face the middle square on
export const inward = (r, t) => Math.atan2(-r.b * Math.cos(t), -r.a * Math.sin(t));
// the angle round the ring nearest (x, z)
export const angleOf = (r, x, z) => Math.atan2((z - r.z) / r.b, (x - r.x) / r.a);

// the ellipse as a shape, `inset` in, with rectangular `holes` [x0, x1, z0, z1]
// (in the shape's own plane: x, and -z facing up, or z facing down; three.js
// winds it the right way round)
function shape(r, inset, holes, down) {
  const n = 96;
  const pts = Array.from({ length: n }, (_, i) => {
    const p = ringAt(r, (i / n) * TAU, inset);
    return new THREE.Vector2(p.x, down ? p.z : -p.z);
  });
  const s = new THREE.Shape(pts);
  for (const [x0, x1, z0, z1] of holes) {
    const v = (x, z) => new THREE.Vector2(x, down ? z : -z);
    s.holes.push(new THREE.Path([v(x0, z0), v(x1, z0), v(x1, z1), v(x0, z1)]));
  }
  return s;
}

// the floor (facing up at y = 0) and the ceiling (facing down at `y`), out to the wall
export const ringFloor = (r, holes = []) => new THREE.ShapeGeometry(shape(r, -0.1, holes, false), 1).rotateX(-Math.PI / 2);
export const ringCeiling = (r, y, holes = []) => new THREE.ShapeGeometry(shape(r, -0.1, holes, true), 1).rotateX(Math.PI / 2).translate(0, y, 0);

// The wall, `h` high and `thick` thick, its inner face on the ring, as boxes
// into frame `f` (one at the world's origin): every run but those `gaps`
// (angles) fall in. Returns the runs drawn, [{ t (its middle's angle), a, b
// (its ends), len, turn }], for what goes on it.
export function ringWall(f, r, { h, color, thick = 0.2, gaps = [], skirt = null, skirtH = 0.12 }) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    const [t0, t1] = [(i / RUNS) * TAU, ((i + 1) / RUNS) * TAU];
    if (gaps.some((g) => angleIn(g, t0, t1))) continue;
    const a = ringAt(r, t0);
    const b = ringAt(r, t1);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const tm = (t0 + t1) / 2;
    const turn = inward(r, tm);
    // out from the line by half its thickness, a hair long so the runs meet
    const ox = -Math.sin(turn) * (thick / 2);
    const oz = -Math.cos(turn) * (thick / 2);
    const ry = Math.atan2(-(b.z - a.z), b.x - a.x);
    f.box(color, (a.x + b.x) / 2 + ox, 0, (a.z + b.z) / 2 + oz, len + 0.04, h, thick, ry);
    if (skirt != null) f.box(skirt, (a.x + b.x) / 2 - ox * 0.2, 0, (a.z + b.z) / 2 - oz * 0.2, len + 0.02, skirtH, 0.04, ry);
    runs.push({ t: tm, a, b, len, turn, ry });
  }
  return runs;
}
const angleIn = (g, t0, t1) => {
  const m = (x) => ((x % TAU) + TAU) % TAU;
  const d = m(g - t0);
  return d >= 0 && d < t1 - t0;
};
