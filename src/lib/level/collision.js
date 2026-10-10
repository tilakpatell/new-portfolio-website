// A level pack's collision, one decision: where the physics engine loads
// (not a phone, not the low tier, a pack with a `physics` section), the
// game's shapes are fixed bodies streamed with the cells
// (surface/level/levelPhysics.js); where it doesn't, they are the walker's
// boxes and circles (havok.js's solidsOf, per placed instance), so the
// walls still stop you, without the stairs. Lanes P0 (this file's engine
// half) and L (the walker's half, `solidsOf`, and the call site in
// scene.js) of docs/superpowers/specs/2026-10-10-bf2017-physics-design.md.
//
//   createLevelCollision({ pack, physics (createPhysics's, or null), loadBin,
//     tier = 'high', instances = [] (the walker's: the far list's placed
//     pieces, [{ mesh, position, quaternion, scale }]) })
//     → Promise<{ solids: [walker solid], floors: [], physics: levelPhysics
//       | null }>
//   solidsOf(pack, cells, loadBin) → Promise<[walker solid]> (cells: [{
//     instances }]; each instance's shapes as boxes and circles)
//   fillSolids(target, list) → target (walker.js's createSolids, filled)
//   wantsEngine({ pack, small, tier }) → bool (the one rule)

import { createLevelPhysics, BUDGETS } from '../../components/galaxy/surface/level/levelPhysics.js';
import { readShapes, solidsOf as instanceSolids } from '../physics/havok.js';

export const wantsEngine = ({ pack, small = false, tier = 'high' }) => Boolean(!small && tier !== 'low' && pack?.physics);

// (a mesh's shapes, read once a pack)
function shapeReader(pack, loadBin) {
  const cache = new Map();
  return (mesh) => {
    const key = String(mesh);
    if (!cache.has(key)) {
      const rec = pack?.physics?.meshes?.[key];
      cache.set(
        key,
        rec
          ? Promise.resolve(loadBin(rec.file))
              .then(readShapes)
              .catch(() => null)
          : Promise.resolve(null),
      );
    }
    return cache.get(key);
  };
}

export async function solidsOf(pack, cells, loadBin) {
  const shapesOf = shapeReader(pack, loadBin);
  const out = [];
  for (const cell of cells)
    for (const inst of cell.instances ?? []) {
      const shapes = await shapesOf(inst.mesh);
      if (shapes?.length) out.push(...instanceSolids(shapes, inst));
    }
  return out;
}

export function fillSolids(target, list) {
  for (const s of list) {
    if (s.type === 'circle') target.circle(s.x, s.z, s.r, { top: s.top, base: s.base, tag: s.tag ?? null });
    else target.box(s.x, s.z, s.hw, s.hd, s.yaw, { top: s.top, base: s.base, tag: s.tag ?? null });
  }
  return target;
}

export async function createLevelCollision({ pack, physics = null, loadBin, tier = 'high', instances = [] }) {
  if (physics && pack?.physics) {
    return { solids: [], floors: [], physics: createLevelPhysics({ physics, pack, loadBin, budget: BUDGETS[tier] ?? BUDGETS.high }) };
  }
  return { solids: await solidsOf(pack, [{ instances }], loadBin), floors: [], physics: null };
}
