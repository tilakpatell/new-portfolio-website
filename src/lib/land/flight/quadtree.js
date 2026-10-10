// The flight's ground as a quadtree on the plane: root tiles ROOT metres a
// side, each split while the camera is nearer than size × SPLIT to its
// centre, down to MAX_DEPTH (a 256 m leaf). Leaves by distance, not rings of
// grids, so no two meshes draw the same ground (the spec's decision 2).
//
// Pure: runs in Node and in a worker.
//
//   keyOf(d, ix, iz) → 'd:ix:iz'; sizeAt(d) → metres
//   leafOf(d, ix, iz) → { key, d, ix, iz, size, x0, z0 } (x0, z0 its min corner)
//   leavesFor(x, z, { split, maxDepth, view }) → Map<key, leaf>, coarse to fine

export const ROOT = 16384;
export const MAX_DEPTH = 6;
export const SPLIT = 1.6;
export const keyOf = (d, ix, iz) => `${d}:${ix}:${iz}`;
export const sizeAt = (d) => ROOT / 2 ** d;
export const leafOf = (d, ix, iz) => ({ key: keyOf(d, ix, iz), d, ix, iz, size: sizeAt(d), x0: ix * sizeAt(d), z0: iz * sizeAt(d) });

// The root tiles within `view` metres, split breadth first, so the Map's
// order is coarse to fine: the streamer asks in that order, the far ground
// first and the detail under the ship next
export function leavesFor(x, z, { split = SPLIT, maxDepth = MAX_DEPTH, view = ROOT * 1.5 } = {}) {
  const out = new Map();
  const rx0 = Math.floor((x - view) / ROOT), rx1 = Math.floor((x + view) / ROOT);
  const rz0 = Math.floor((z - view) / ROOT), rz1 = Math.floor((z + view) / ROOT);
  const queue = [];
  for (let iz = rz0; iz <= rz1; iz++) for (let ix = rx0; ix <= rx1; ix++) queue.push(leafOf(0, ix, iz));
  // an index, not shift(): shift is linear, and the queue reaches hundreds
  for (let q = 0; q < queue.length; q++) {
    const l = queue[q];
    const cx = l.x0 + l.size / 2, cz = l.z0 + l.size / 2;
    const near = Math.hypot(x - cx, z - cz) < l.size * split;
    if (near && l.d < maxDepth) {
      for (let dz = 0; dz < 2; dz++) for (let dx = 0; dx < 2; dx++) queue.push(leafOf(l.d + 1, l.ix * 2 + dx, l.iz * 2 + dz));
    } else out.set(l.key, l);
  }
  return out;
}
