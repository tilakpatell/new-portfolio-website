// A level's instances cut into cells (lane L, "How a level draws"): 128 m
// squares in the site's frame, each a list of draws, one for each mesh and
// side (a mirrored instance draws with its faces' other side, so it cannot
// share an InstancedMesh with the unmirrored ones), sorted by mesh so a
// cell's bin holds each draw as one contiguous range.
//
//   cellsOf(instances, meshOf, { cell = 128, reach }) → Map<'cx,cz', { draws: [{ mesh, indices, mirrored }], bounds }>
//   weightOf(draw, mesh) → instances × the mesh's bounding volume

import { CELL, cellKey, cellOf, isMirrored } from '../../src/lib/level/instances.js';

export function cellsOf(instances, meshOf, { cell = CELL, reach = () => 0 } = {}) {
  const cells = new Map();
  const p = instances.position;
  for (let i = 0; i < instances.count; i++) {
    const x = p[i * 3];
    const y = p[i * 3 + 1];
    const z = p[i * 3 + 2];
    const key = cellKey(...cellOf(x, z, cell));
    let c = cells.get(key);
    if (!c) cells.set(key, (c = { byDraw: new Map(), bounds: [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity] }));
    const mesh = meshOf[i];
    const mirrored = isMirrored(instances.scale, i);
    const dk = `${mesh}|${mirrored}`;
    if (!c.byDraw.has(dk)) c.byDraw.set(dk, { mesh, indices: [], mirrored });
    c.byDraw.get(dk).indices.push(i);
    const r = reach(mesh, i);
    const b = c.bounds;
    b[0] = Math.min(b[0], x - r);
    b[1] = Math.min(b[1], y - r);
    b[2] = Math.min(b[2], z - r);
    b[3] = Math.max(b[3], x + r);
    b[4] = Math.max(b[4], y + r);
    b[5] = Math.max(b[5], z + r);
  }
  const out = new Map();
  for (const [key, c] of cells) {
    const draws = [...c.byDraw.values()].sort((a, b) => a.mesh - b.mesh || Number(a.mirrored) - Number(b.mirrored));
    out.set(key, { draws, bounds: c.bounds });
  }
  return out;
}

// (a flat piece, a decal or a floor plate, still weighs a centimetre of depth)
export function weightOf(draw, mesh) {
  const [x0, y0, z0, x1, y1, z1] = mesh.bounds;
  return draw.indices.length * Math.max(x1 - x0, 0.01) * Math.max(y1 - y0, 0.01) * Math.max(z1 - z0, 0.01);
}
