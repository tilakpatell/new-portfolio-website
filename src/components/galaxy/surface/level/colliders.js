// The level's collision in the walk world (lane L, task 4): a cell's floors
// and solids (src/lib/level/collision.js) added to the scene's walk world
// when the cell comes, switched off when it goes and on again when it
// comes back (the walk world's shapes have no remove: `off` is how a gate
// or a trapdoor goes, walker.js), so nothing is added twice.
//
//   createColliders({ solids, floors }, tier) → { add(key, pack, bin), drop(key), dispose() }
// (a mesh the tier does not draw stops no one: no wall you cannot see)

import { solidsOf } from '../../../../lib/level/collision.js';

export function createColliders(walk, tier = 'high') {
  const byCell = new Map(); // key → the shapes it added
  const set = (key, off) => {
    for (const s of byCell.get(key) ?? []) s.off = off;
  };
  return {
    add(key, pack, bin) {
      if (byCell.has(key)) return set(key, false);
      const c = pack.cells[key];
      if (!c) return;
      const { floors, boxes } = solidsOf(pack, c.draws.filter((d) => !pack.cull?.[tier]?.dropped?.includes(d.mesh)), bin);
      const added = [];
      for (const f of floors) {
        const floor = { ...f, tag: `level:${key}` };
        walk.floors.push(floor);
        added.push(floor);
      }
      for (const b of boxes) added.push(walk.solids.box(b.x, b.z, b.hw, b.hd, b.yaw, { top: b.top, base: b.base, tag: `level:${key}` }));
      byCell.set(key, added);
    },
    drop: (key) => set(key, true),
    dispose() {
      for (const key of byCell.keys()) set(key, true);
    },
  };
}
