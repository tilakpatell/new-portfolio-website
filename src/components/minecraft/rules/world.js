// Minecraft, the loaded world: the chunks the sim holds, read and written in
// world coordinates (any real number: it floors to the cell). Outside every
// loaded chunk the world is stone below the sea and air above, so a body at
// the edge of what's loaded stands rather than falling through.

import { BLOCKS } from './blocks.js';
import { shapeBoxes } from './mesher.js';
import { chunkOf, get as getIn, getState as stateIn, key, local, set as setIn } from './chunk.js';

const STONE = 1;
const SEA = 63;
const SOLID = new Uint8Array(256);
BLOCKS.forEach((b, i) => (SOLID[i] = b.solid ? 1 : 0));
// the shapes the mover meets as boxes rather than a whole cell (by state)
const SHAPED = new Set(['slab', 'stairs', 'door']);

export function makeWorld() {
  const chunks = new Map();
  const chunkAt = (cx, cz) => chunks.get(key(cx, cz)) ?? null;
  const find = (x, z) => chunkAt(chunkOf(Math.floor(x)), chunkOf(Math.floor(z)));
  const get = (x, y, z) => {
    const c = find(x, z);
    const fy = Math.floor(y);
    if (!c) return fy < SEA && fy >= 0 ? STONE : 0;
    return getIn(c, local(Math.floor(x)), fy, local(Math.floor(z)));
  };
  return {
    chunks,
    chunkAt,
    get,
    getState(x, y, z) {
      const c = find(x, z);
      return c ? stateIn(c, local(Math.floor(x)), Math.floor(y), local(Math.floor(z))) : 0;
    },
    set(x, y, z, id, state = 0) {
      const c = find(x, z);
      if (!c || y < 0 || y > 255) return false;
      const lx = local(Math.floor(x));
      const lz = local(Math.floor(z));
      setIn(c, lx, Math.floor(y), lz, id, state);
      // a cell on the chunk's edge shows a face of the chunk beside it: that one meshes again too
      const s = Math.floor(y) >> 4;
      if (lx === 0) chunkAt(c.cx - 1, c.cz)?.dirty.add(s);
      if (lx === 15) chunkAt(c.cx + 1, c.cz)?.dirty.add(s);
      if (lz === 0) chunkAt(c.cx, c.cz - 1)?.dirty.add(s);
      if (lz === 15) chunkAt(c.cx, c.cz + 1)?.dirty.add(s);
      return true;
    },
    solid: (x, y, z) => SOLID[get(x, y, z)] === 1,
    // a cell's boxes for the mover when it isn't a whole block (a slab, a bed); null for a cube
    boxes(x, y, z) {
      const b = BLOCKS[get(x, y, z)];
      if (!SHAPED.has(b.shape) || (b.shape === 'slab' && b.height >= 16)) return null;
      const st = this.getState(x, y, z);
      return shapeBoxes(b.shape, st, b.height).map((box) => box.map((v) => v / 16));
    },
    loaded: (x, z) => Boolean(find(x, z)),
    neighbours: (cx, cz) => ({ nx: chunkAt(cx - 1, cz), px: chunkAt(cx + 1, cz), nz: chunkAt(cx, cz - 1), pz: chunkAt(cx, cz + 1), nxnz: chunkAt(cx - 1, cz - 1), pxnz: chunkAt(cx + 1, cz - 1), nxpz: chunkAt(cx - 1, cz + 1), pxpz: chunkAt(cx + 1, cz + 1) }),
  };
}
