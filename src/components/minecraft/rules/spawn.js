// Minecraft, where mobs come from and go, as 1.12's WorldEntitySpawner:
//
// - Monsters, every tick: a cap of 70 for every 289 chunks loaded within 8
//   of the player; each such chunk tries a random cell (y up to the top of
//   its column), then three packs of up to four, each step up to 5 across,
//   of one kind (spider, zombie, skeleton, creeper 100 each, enderman 10).
//   A cell takes one if it's 24 or more from the player and from the
//   world's spawn, on something solid with room for the body and no
//   liquid, and dark enough: sky light no more than a roll of 32, and the
//   light (the sky's less the night's darkening, or a lamp's) no more than
//   a roll of 8 — so never at 8 or more.
// - Animals, every 400 ticks, on grass in light over 8: a cap of 10 per 289
//   chunks; and when a chunk is first made, a 1 in 10 chance of a herd of
//   2 to 4 of one kind (sheep 12, pig 10, chicken 10, cow 8).
// - Despawning (monsters only): past 128 from the player at once; idle
//   past 32, one chance in 800 a tick once idle 600 ticks; within 32 the
//   idle count starts again.

import { byName } from './blocks.js';
import { chunkOf, key } from './chunk.js';
import { MOBS, makeMob } from './mobs/index.js';
import { skyDarken } from './time.js';

const GRASS = byName.get('grass_block').id;
const BEDROCK = byName.get('bedrock').id;
const MONSTERS = [
  ['spider', 100],
  ['zombie', 100],
  ['skeleton', 100],
  ['creeper', 100],
  ['enderman', 10],
];
const ANIMALS = [
  ['sheep', 12],
  ['pig', 10],
  ['chicken', 10],
  ['cow', 8],
];
const pick = (list, rand) => {
  let r = rand() * list.reduce((n, [, w]) => n + w, 0);
  for (const [k, w] of list) if ((r -= w) < 0) return k;
  return list[0][0];
};
const nextInt = (rand, n) => Math.floor(rand() * n);
const isAnimal = (kind) => Boolean(MOBS[kind].animal);

// Whether a `kind` may appear standing at (x, y, z) now.
export function spawnable(g, kind, x, y, z, rand = g.spawnRand) {
  const w = g.world;
  const p = g.player;
  const cx = x + 0.5;
  const cz = z + 0.5;
  if (!w.loaded(cx, cz) || y < 1 || y > 254) return false;
  if ((cx - p.x) ** 2 + (y - p.y) ** 2 + (cz - p.z) ** 2 < 576) return false;
  const home = g.home ?? g.spawn;
  if (home && (cx - home.x) ** 2 + (y - home.y) ** 2 + (cz - home.z) ** 2 < 576) return false;
  // standing room: solid under, the body's cells clear and dry
  const below = w.get(x, y - 1, z);
  if (!w.solid(x, y - 1, z) || below === BEDROCK) return false;
  const t = MOBS[kind];
  for (let dy = 0; dy < Math.ceil(t.h); dy++) {
    if (w.solid(x, y + dy, z) || w.get(x, y + dy, z) !== 0) return false;
  }
  if (t.w > 1) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (w.solid(x + dx, y, z + dz)) return false;
  const l = w.light(x, y, z);
  const sky = l >> 4;
  const level = Math.max(sky - skyDarken(g.time), l & 15);
  if (isAnimal(kind)) return below === GRASS && level > 8;
  if (sky > nextInt(rand, 32)) return false;
  return level <= nextInt(rand, 8);
}

// the chunks the spawner works: loaded, within 8 of the player's
function eligible(g) {
  const pcx = chunkOf(Math.floor(g.player.x));
  const pcz = chunkOf(Math.floor(g.player.z));
  const out = [];
  for (let dz = -8; dz <= 8; dz++)
    for (let dx = -8; dx <= 8; dx++) {
      const c = g.world.chunks.get(key(pcx + dx, pcz + dz));
      if (c) out.push(c);
    }
  return out;
}

// a chunk's highest filled cell, worked out once
function topOf(c) {
  if (c.top != null) return c.top;
  for (let y = 255; y >= 0; y--) {
    const base = y * 256;
    for (let i = 0; i < 256; i++)
      if (c.ids[base + i]) {
        c.top = y;
        return y;
      }
  }
  c.top = 0;
  return 0;
}

function spawnIn(g, chunks, animals) {
  const rand = g.spawnRand;
  const cap = Math.floor(((animals ? 10 : 70) * chunks.length) / 289);
  let count = g.mobs.filter((m) => !m.dead && isAnimal(m.kind) === animals).length;
  if (count >= cap) return 0;
  let made = 0;
  for (const c of chunks) {
    const x0 = c.cx * 16 + nextInt(rand, 16);
    const z0 = c.cz * 16 + nextInt(rand, 16);
    // (the game's height map is the first open cell over the column: one over the top block)
    const top = Math.ceil((topOf(c) + 2) / 16) * 16;
    const y = nextInt(rand, top > 0 ? top : 16);
    if (g.world.solid(x0, y, z0)) continue;
    let inChunk = 0;
    for (let pack = 0; pack < 3; pack++) {
      let x = x0;
      let z = z0;
      let kind = null;
      for (let n = 0; n < 4; n++) {
        x += nextInt(rand, 6) - nextInt(rand, 6);
        z += nextInt(rand, 6) - nextInt(rand, 6);
        kind ??= pick(animals ? ANIMALS : MONSTERS, rand);
        if (!spawnable(g, kind, x, y, z, rand)) continue;
        const m = makeMob(kind, x + 0.5, y, z + 0.5, rand);
        g.mobs.push(m);
        made++;
        count++;
        if (++inChunk >= 4) break;
      }
      if (inChunk >= 4) break;
    }
    if (count >= cap) break;
  }
  return made;
}

export function spawnTick(g) {
  if (g.dead) return;
  const chunks = eligible(g);
  spawnIn(g, chunks, false);
  if (g.time % 400 === 0) spawnIn(g, chunks, true);
}

// A chunk made for the first time: a herd, now and then (performWorldGenSpawning)
export function populate(g, c) {
  const k = key(c.cx, c.cz);
  g.populated ??= new Set();
  if (g.populated.has(k)) return;
  g.populated.add(k);
  const rand = g.spawnRand;
  while (rand() < 0.1) {
    const kind = pick(ANIMALS, rand);
    const n = 2 + nextInt(rand, 3);
    let x = c.cx * 16 + nextInt(rand, 16);
    let z = c.cz * 16 + nextInt(rand, 16);
    for (let i = 0; i < n; i++) {
      // the column's top, where it's grass
      let y = topOf(c) + 1;
      while (y > 1 && !g.world.solid(x, y - 1, z)) y--;
      if (g.world.get(x, y - 1, z) === GRASS && !g.world.solid(x, y, z) && !g.world.solid(x, y + 1, z)) g.mobs.push(makeMob(kind, x + 0.5, y, z + 0.5, rand));
      x += nextInt(rand, 5) - nextInt(rand, 5);
      z += nextInt(rand, 5) - nextInt(rand, 5);
      x = Math.min(c.cx * 16 + 15, Math.max(c.cx * 16, x));
      z = Math.min(c.cz * 16 + 15, Math.max(c.cz * 16, z));
    }
  }
}

// EntityLiving.despawnEntity, for the monsters
export function despawn(g) {
  const p = g.player;
  g.mobs = g.mobs.filter((m) => {
    if (isAnimal(m.kind)) return true;
    const d2 = (m.x - p.x) ** 2 + (m.y - p.y) ** 2 + (m.z - p.z) ** 2;
    if (d2 > 128 * 128) return false;
    if (d2 < 32 * 32) m.idle = 0;
    else if (++m.idle > 600 && g.spawnRand() < 1 / 800) return false;
    return true;
  });
}
