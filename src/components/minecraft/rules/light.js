// Minecraft, light: the game's two kinds, 0 to 15 a cell.
//
// - Sky light comes straight down at 15 through anything that lets light
//   through untouched (air, glass, plants), and from there spreads out a
//   level less a step, round corners and into overhangs. Leaves and water
//   take one more off as it passes (opacity 1); a solid block stops it.
// - Block light comes from what glows (a torch 14, glowstone, lava and a
//   jack o'lantern 15, a lit furnace 13) and spreads the same way.
//
// Both are flood fills. A chunk's light can come from up to 14 blocks into
// its neighbours (15 levels, one off a step), so the centre chunk is lit
// with a 14-block margin of the eight chunks round it, which is exact: what
// lies further can't reach it. The worker has those chunks already (it makes
// them to mesh against), so lighting costs a fill over the margin and no
// round trip. The neighbours' cells next to the centre come back too, for
// the mesher, which reads the light of the cell each face looks into.

import { BLOCKS } from './blocks.js';
import { index } from './chunk.js';

const M = 14;
const P = 16 + 2 * M;
const LAYER = P * P;

export const OPACITY = new Uint8Array(256);
export const EMIT = new Uint8Array(256);
for (const b of BLOCKS) {
  OPACITY[b.id] = b.opaque ? 15 : /_leaves$/.test(b.name) || b.name === 'water' || b.name === 'ice' ? 1 : 0;
  EMIT[b.id] = b.light;
}

// the fill's working space, made once and reused (a light is half a million cells)
let op = null;
let sky = null;
let blk = null;
let queue = null;

const SIDES = { nx: [-1, 0], px: [1, 0], nz: [0, -1], pz: [0, 1], nxnz: [-1, -1], pxnz: [1, -1], nxpz: [-1, 1], pxpz: [1, 1] };

// centre: a chunk; around: its eight neighbours by side (any may be missing:
// it's read as open air). Says the centre's light (sky << 4 | block), and
// the neighbours' as far as the margin reaches.
export function lightRegion(centre, around = {}) {
  const grid = [[around.nxnz, around.nz, around.pxnz], [around.nx, centre, around.px], [around.nxpz, around.pz, around.pxpz]];
  if (!op) {
    op = new Uint8Array(LAYER * 256);
    sky = new Uint8Array(LAYER * 256);
    blk = new Uint8Array(LAYER * 256);
    queue = new Int32Array(LAYER * 256);
  }
  blk.fill(0);
  let head = 0;
  let tail = 0;
  const pIndex = (px, y, pz) => (y * P + pz) * P + px;

  // what's in each cell, and the sky straight down each column
  let reach = 0; // above this every cell has the whole sky: nothing to spread
  for (let pz = 0; pz < P; pz++)
    for (let px = 0; px < P; px++) {
      const wx = px - M;
      const wz = pz - M;
      const gx = wx < 0 ? 0 : wx > 15 ? 2 : 1;
      const gz = wz < 0 ? 0 : wz > 15 ? 2 : 1;
      const c = grid[gz][gx];
      const lx = wx - (gx - 1) * 16;
      const lz = wz - (gz - 1) * 16;
      let level = 15;
      const ids = c?.ids;
      const col = lz * 16 + lx;
      for (let y = 255; y >= 0; y--) {
        const p = (y * P + pz) * P + px;
        const id = ids ? ids[y * 256 + col] : 0;
        const o = OPACITY[id];
        op[p] = o;
        if (EMIT[id]) {
          blk[p] = EMIT[id];
          queue[tail++] = p;
        }
        if (o >= 15) level = 0;
        else if (!(level === 15 && o === 0)) level = Math.max(0, level - Math.max(1, o));
        sky[p] = level;
        if (level < 15 && reach < y + 1) reach = y + 1;
      }
    }

  // spread: a level less a step (more through leaves and water), never into a solid block
  const spread = (arr) => {
    while (head < tail) {
      const p = queue[head++];
      const l = arr[p];
      if (l <= 1) continue;
      const px = p % P;
      const pz = Math.floor(p / P) % P;
      const y = Math.floor(p / LAYER);
      const next = (q) => {
        const o = op[q];
        if (o >= 15) return;
        const nl = l - Math.max(1, o);
        if (nl > arr[q]) {
          arr[q] = nl;
          queue[tail++] = q;
        }
      };
      if (px > 0) next(p - 1);
      if (px < P - 1) next(p + 1);
      if (pz > 0) next(p - P);
      if (pz < P - 1) next(p + P);
      if (y > 0) next(p - LAYER);
      if (y < 255) next(p + LAYER);
    }
    head = 0;
    tail = 0;
  };
  spread(blk);

  // the sky's cells that have somewhere darker beside them start its spread
  for (let y = 0; y <= Math.min(255, reach); y++)
    for (let pz = 0; pz < P; pz++)
      for (let px = 0; px < P; px++) {
        const p = pIndex(px, y, pz);
        const l = sky[p];
        if (l <= 1) continue;
        if ((px > 0 && sky[p - 1] < l - 1) || (px < P - 1 && sky[p + 1] < l - 1) || (pz > 0 && sky[p - P] < l - 1) || (pz < P - 1 && sky[p + P] < l - 1) || (y > 0 && sky[p - LAYER] < l - 1)) queue[tail++] = p;
      }
  spread(sky);

  // out: the centre whole, and the neighbours' cells next to it (the ones its faces look into)
  const take = (gx, gz) => {
    const out = new Uint8Array(65536);
    for (let lz = 0; lz < 16; lz++)
      for (let lx = 0; lx < 16; lx++) {
        const wx = lx + (gx - 1) * 16;
        const wz = lz + (gz - 1) * 16;
        if (wx < -1 || wx > 16 || wz < -1 || wz > 16) continue;
        const px = wx + M;
        const pz = wz + M;
        for (let y = 0; y < 256; y++) {
          const p = pIndex(px, y, pz);
          out[index(lx, y, lz)] = (sky[p] << 4) | blk[p];
        }
      }
    return out;
  };
  const result = { centre: take(1, 1), around: {} };
  for (const [side, [dx, dz]] of Object.entries(SIDES)) result.around[side] = take(dx + 1, dz + 1);
  return result;
}
