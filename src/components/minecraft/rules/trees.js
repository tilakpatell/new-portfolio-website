// Minecraft, the trees, grown by the game's own shapes from a random stream:
// the small oak and the birch (WorldGenTrees: a trunk, two wide layers of
// leaves round its top and two narrow ones, their corners left out at random
// and always on the topmost) and the spruce (WorldGenTaiga2: rings of leaves
// stepping out and back down the trunk, a cone).
//
// `put(x, y, z, id)` writes anywhere in the world; the generator decides what
// it may overwrite (leaves only into air, logs into air or leaves), so trees
// that overlap come out the same whichever is grown first.

import { byName } from './blocks.js';

const ID = (n) => byName.get(n).id;
const LOG = { oak: ID('oak_log'), birch: ID('birch_log'), spruce: ID('spruce_log') };
const LEAVES = { oak: ID('oak_leaves'), birch: ID('birch_leaves'), spruce: ID('spruce_leaves') };
const int = (rand, n) => Math.floor(rand() * n);

// How tall the tree's trunk is and how far its leaves reach, for room checks.
export const REACH = { oak: 2, birch: 2, spruce: 3 };

function smallTree(kind, x, y, z, put, rand, height) {
  for (let yy = y + height - 3; yy <= y + height; yy++) {
    const dy = yy - (y + height);
    const r = 1 - Math.trunc(dy / 2);
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) {
        // the game's corner rule: a corner stays only on a coin toss, and never on top
        if (Math.abs(dx) === r && Math.abs(dz) === r && (int(rand, 2) === 0 || dy === 0)) continue;
        put(x + dx, yy, z + dz, LEAVES[kind]);
      }
  }
  for (let i = 0; i < height; i++) put(x, y + i, z, LOG[kind]);
}

function spruce(x, y, z, put, rand) {
  const height = int(rand, 4) + 6;
  const bare = 1 + int(rand, 2);
  const crown = height - bare;
  const most = 2 + int(rand, 2);
  let r = int(rand, 2);
  let next = 1;
  let reset = 0;
  for (let i = 0; i <= crown; i++) {
    const yy = y + height - i;
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) === r && Math.abs(dz) === r && r > 0) continue;
        put(x + dx, yy, z + dz, LEAVES.spruce);
      }
    if (r >= next) {
      r = reset;
      reset = 1;
      next = Math.min(next + 1, most);
    } else r++;
  }
  const trunk = height - int(rand, 3);
  for (let i = 0; i < trunk; i++) put(x, y + i, z, LOG.spruce);
}

// Grows a tree whose trunk stands on (x, y − 1, z).
export function placeTree(kind, x, y, z, put, rand) {
  if (kind === 'spruce') return spruce(x, y, z, put, rand);
  const height = kind === 'birch' ? int(rand, 3) + 5 : int(rand, 3) + 4;
  return smallTree(kind, x, y, z, put, rand, height);
}
