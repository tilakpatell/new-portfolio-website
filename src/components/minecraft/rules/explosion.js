// Minecraft, an explosion, as the game's (Explosion.doExplosionA/B, 1.12):
// rays out from the middle to every cell on the surface of a 16³ cube, each
// starting with power × (0.7 to 1.3) and losing 0.225 a 0.3 step, and more
// for every block it passes, by that block's blast resistance; what a ray
// still has strength in goes. A third of what goes (1 in power) drops as
// itself. Bodies within twice the power are hurt by how near they are times
// how much of them the blast can see: ((i² + i) / 2) × 7 × 2 × power + 1,
// and thrown by i.

import { BLOCKS, byName } from './blocks.js';
import { setBlock, spawnDrop } from './build.js';
import { hurtPlayer } from './combat.js';
import { hurtMob } from './mobs/index.js';

// blast resistance, as the game works it: max(resistance × 3, hardness × 5) / 5
const RESIST = {
  stone: 6,
  cobblestone: 6,
  bricks: 6,
  stone_bricks: 6,
  mossy_cobblestone: 6,
  iron_block: 6,
  gold_block: 6,
  diamond_block: 6,
  obsidian: 1200,
  bedrock: Infinity,
  water: 100,
  lava: 100,
  oak_planks: 3,
  birch_planks: 3,
  spruce_planks: 3,
  jungle_planks: 3,
  acacia_planks: 3,
  oak_fence: 3,
  oak_stairs: 3,
  oak_slab: 3,
  coal_ore: 3,
  iron_ore: 3,
  gold_ore: 3,
  redstone_ore: 3,
  lapis_ore: 3,
  diamond_ore: 3,
};
export const resistanceOf = (b) => RESIST[b.name] ?? (b.hardness === Infinity ? Infinity : b.hardness);
const RES = BLOCKS.map(resistanceOf);
const AIR = 0;
const WATER = byName.get('water').id;

// how much of a body the blast at (x, y, z) can see: rays to points over its box
function exposure(g, x, y, z, b) {
  let seen = 0;
  let all = 0;
  for (let i = 0; i <= 1; i += 0.5)
    for (let j = 0; j <= 1; j += 0.5)
      for (let k = 0; k <= 1; k += 0.5) {
        const tx = b.x - b.w / 2 + b.w * i;
        const ty = b.y + b.h * j;
        const tz = b.z - b.w / 2 + b.w * k;
        const n = Math.ceil(Math.hypot(tx - x, ty - y, tz - z) / 0.3);
        let clear = true;
        for (let s = 1; s < n && clear; s++) if (g.world.solid(x + ((tx - x) * s) / n, y + ((ty - y) * s) / n, z + ((tz - z) * s) / n)) clear = false;
        if (clear) seen++;
        all++;
      }
  return seen / all;
}

export function explode(g, x, y, z, power, { by = null } = {}) {
  const rand = g.rand;
  const gone = new Set();
  // in water, a blast breaks nothing
  if (g.world.get(x, y, z) !== WATER)
    for (let i = 0; i < 16; i++)
      for (let j = 0; j < 16; j++)
        for (let k = 0; k < 16; k++) {
          if (i !== 0 && i !== 15 && j !== 0 && j !== 15 && k !== 0 && k !== 15) continue;
          let dx = (i / 15) * 2 - 1;
          let dy = (j / 15) * 2 - 1;
          let dz = (k / 15) * 2 - 1;
          const len = Math.hypot(dx, dy, dz);
          dx /= len;
          dy /= len;
          dz /= len;
          let f = power * (0.7 + rand() * 0.6);
          let px = x;
          let py = y;
          let pz = z;
          for (; f > 0; f -= 0.22500001) {
            const cx = Math.floor(px);
            const cy = Math.floor(py);
            const cz = Math.floor(pz);
            const id = g.world.get(cx, cy, cz);
            if (id !== AIR) f -= (RES[id] + 0.3) * 0.3;
            if (f > 0 && id !== AIR && cy >= 0 && cy < 256) gone.add(`${cx},${cy},${cz}`);
            px += dx * 0.3;
            py += dy * 0.3;
            pz += dz * 0.3;
          }
        }
  // the bodies, before the blocks go (the game hurts with the blocks still there)
  const reach = power * 2;
  const p = g.player;
  const hurtBy = (b) => {
    const d = Math.hypot(b.x - x, b.y + b.h / 2 - y, b.z - z) / reach;
    if (d > 1) return 0;
    const i = (1 - d) * exposure(g, x, y, z, b);
    const dist = Math.hypot(b.x - x, b.y + b.h / 2 - y, b.z - z) || 1;
    b.vx += ((b.x - x) / dist) * i;
    b.vy += ((b.y + b.h / 2 - y) / dist) * i;
    b.vz += ((b.z - z) / dist) * i;
    return Math.floor(((i * i + i) / 2) * 7 * reach + 1);
  };
  const events = [];
  if (!g.dead) {
    const dmg = hurtBy(p);
    if (dmg > 0) hurtPlayer(g, dmg, { cause: by ?? 'explosion' });
  }
  for (const m of g.mobs ?? []) {
    if (m.dead || m.gone) continue;
    const dmg = hurtBy(m);
    if (dmg > 0) events.push(...hurtMob(null, m, dmg, { cause: 'explosion', knock: 0 }));
  }
  for (const k of gone) {
    const [cx, cy, cz] = k.split(',').map(Number);
    const b = BLOCKS[g.world.get(cx, cy, cz)];
    if (b.hardness === Infinity) continue;
    if (rand() < 1 / power) for (const d of b.drops(g.world.getState(cx, cy, cz), null, rand)) spawnDrop(g, d.item, d.count, cx + 0.5, cy + 0.25, cz + 0.5);
    setBlock(g, cx, cy, cz, AIR);
  }
  g.events.push(...events, { type: 'explode', x, y, z, power, blocks: gone.size });
  return gone.size;
}
