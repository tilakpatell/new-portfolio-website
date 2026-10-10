// What you walk on and stop at in a level pack (lane L, task 4): each
// instance's mesh bounds, turned and scaled as it is placed, as the walk
// layer's shapes (galaxy/surface/walker.js): a flat piece you could stand on
// (a hangar floor plate, a walkway, a ramp's deck) is a floor at its top; a
// tall one (a wall, a crate, a pylon) a box solid from its base to its top.
// Pure; the scene adds them per cell and switches them off when a cell goes.
// (The Havok shapes come through lib/physics when the Rapier body lane is on
// main; until then the bounds stand in.)
//
//   yawOf([x, y, z, w]) → the turn about y
//   colliderOf(mesh, position, yaw, scale) → { floor } | { box } | null
//   solidsOf(pack, draws, bin) → { floors, boxes }

import { readInstances } from './instances.js';

// a floor: no thicker than this, and at least this wide each way (metres)
const FLOOR = { thick: 1, wide: 2 };
// smaller than this each way stops no one (snow debris, cables, bolts)
const TINY = 0.3;
// a box this big would be a wall of air round a rock or a glacier: those
// wait for their real shapes (the Havok sets, through lib/physics)
const BIG = 15;

export const yawOf = ([x, y, z, w]) => {
  const a = Math.atan2(2 * (w * y + x * z), 1 - 2 * (x * x + y * y));
  return a === 0 ? 0 : a;
};

export function colliderOf(mesh, [px, py, pz], yaw, [sx, sy, sz]) {
  const b = mesh.collision?.bounds ?? mesh.bounds;
  const hw = (Math.abs(sx) * (b[3] - b[0])) / 2;
  const hd = (Math.abs(sz) * (b[5] - b[2])) / 2;
  const lo = py + Math.min(sy * b[1], sy * b[4]);
  const hi = py + Math.max(sy * b[1], sy * b[4]);
  if (hw * 2 < TINY && hd * 2 < TINY) return null;
  // the bounds' middle, turned as three turns a thing about y
  const cx = (sx * (b[0] + b[3])) / 2;
  const cz = (sz * (b[2] + b[5])) / 2;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const x = px + cx * c + cz * s;
  const z = pz - cx * s + cz * c;
  const round = (v) => Math.round(v * 1000) / 1000;
  if (hi - lo <= FLOOR.thick && Math.min(hw, hd) * 2 >= FLOOR.wide) return { floor: { x: round(x), z: round(z), hw: round(hw), hd: round(hd), yaw, y: round(hi) } };
  if (Math.max(hw, hd) > BIG) return null;
  return { box: { x: round(x), z: round(z), hw: round(hw), hd: round(hd), yaw, top: round(hi), base: round(lo) } };
}

export function solidsOf(pack, draws, bin) {
  const inst = readInstances(bin);
  const floors = [];
  const boxes = [];
  for (const d of draws) {
    const mesh = pack.meshes[d.mesh];
    for (let i = d.offset; i < d.offset + d.count; i++) {
      const q = inst.quaternion.subarray(i * 4, i * 4 + 4);
      const got = colliderOf(mesh, inst.position.subarray(i * 3, i * 3 + 3), yawOf(q), inst.scale.subarray(i * 3, i * 3 + 3));
      if (got?.floor) floors.push(got.floor);
      else if (got?.box) boxes.push(got.box);
    }
  }
  return { floors, boxes };
}
