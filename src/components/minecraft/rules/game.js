// Minecraft, the sim: the loaded chunks, the player and the clock, stepped
// at the game's 20 ticks a second from the page's input. It doesn't make
// chunks itself: it says which columns it wants (`wantedChunks`, nearest
// first), the module has the worker make and mesh them, and `addChunk`
// takes them in; `dropFar` lets go of the ones left behind. Until the chunk
// under the player has come, the player is held where they are, as the game
// holds a player in an unloaded chunk.
//
// Each tick the crosshair's block is found again from the eye (`g.cursor`),
// and the hands work on it (rules/build.js): breaking, placing, the sand
// that falls, the items dropped.
//
// Events (a landing, a step, a hurt, a break, a place, a pickup) collect on
// the game for the module to `drain` once a frame: sounds, the HUD.

import { seeded } from '../../../lib/seeded.js';
import { stepDrops, stepHands, stepUpdates } from './build.js';
import { applyEdits, chunkOf, key, makeChunk, packEdits } from './chunk.js';
import { makeInventory } from './inventory.js';
import { hashSeed } from './noise.js';
import { inWater } from './physics.js';
import { eyeOf, makePlayer, stepPlayer } from './player.js';
import { raycast } from './raycast.js';
import { makeWorld } from './world.js';
import { SEA, makeGenerator } from './worldgen.js';

export const NOON = 6000;
const GRASSY = new Set(['plains', 'forest', 'birch_forest', 'taiga']);

// Where a new world starts: the first grassy column scanning out from
// (0, 0) in rings, standing on its surface with room for a body.
export function spawnPoint(gen) {
  const fits = (x, z) => {
    const c = makeChunk(chunkOf(x), chunkOf(z));
    gen.generate(c);
    const lx = x - c.cx * 16;
    const lz = z - c.cz * 16;
    const h = gen.height(x, z);
    const at = (y) => c.ids[(y * 16 + lz) * 16 + lx];
    return at(h + 1) === 0 && at(h + 2) === 0 && at(h) !== 0 ? h : null;
  };
  for (const strict of [true, false])
    for (let r = 0; r < 4000; r += 8)
      for (let a = 0; a < Math.max(1, Math.round((2 * Math.PI * r) / 8)); a++) {
        const t = r ? (a / Math.round((2 * Math.PI * r) / 8)) * 2 * Math.PI : 0;
        const x = Math.round(Math.cos(t) * r);
        const z = Math.round(Math.sin(t) * r);
        const h = gen.height(x, z);
        if (h <= SEA || (strict && !GRASSY.has(gen.biome(x, z, h)))) continue;
        const ok = fits(x, z);
        if (ok !== null) return { x: x + 0.5, y: ok + 1, z: z + 0.5 };
      }
  return { x: 0.5, y: 120, z: 0.5 };
}

export function newGame({ seed = Date.now(), save = null } = {}) {
  const s = hashSeed(save?.seed ?? seed);
  const gen = makeGenerator(s);
  const spawn = save?.player?.spawn ?? spawnPoint(gen);
  const at = save?.player ?? spawn;
  const player = makePlayer(at);
  player.yaw = save?.player?.yaw ?? 0;
  player.pitch = save?.player?.pitch ?? 0;
  player.health = save?.player?.health ?? player.health;
  player.hunger = save?.player?.hunger ?? player.hunger;
  const inventory = makeInventory();
  if (save?.inventory) {
    save.inventory.slots.forEach((st, i) => (inventory.slots[i] = st ? { ...st } : null));
    inventory.selected = save.inventory.selected ?? 0;
  }
  return {
    seed: s,
    gen,
    world: makeWorld(),
    player,
    spawn,
    time: save?.time ?? NOON,
    ticks: 0,
    renderDistance: 10,
    maxChunks: 1000,
    events: [],
    inventory,
    // the edits of chunks not loaded now, packed, by chunk key (rules/save.js)
    edits: { ...(save?.edits ?? {}) },
    chests: { ...(save?.chests ?? {}) },
    cursor: null,
    breaking: null,
    cooldown: 0,
    updates: [],
    drops: [],
    // the world's own dice (drops, scatter), so a game replays the same
    rand: seeded(s ^ 0x6d63),
  };
}

export { FACING, breakBlock, dropHeld, placeBlock, setBlock, spawnDrop } from './build.js';

// the way the eyes look, from the yaw and pitch
export const lookDir = (yaw, pitch) => ({ x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) });

// The columns in reach, nearest first: a square of the render distance
// round the player's chunk, as the game loads.
export function wantedChunks(g) {
  const pcx = chunkOf(Math.floor(g.player.x));
  const pcz = chunkOf(Math.floor(g.player.z));
  const r = g.renderDistance;
  const out = [];
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) out.push([dx, dz, dx * dx + dz * dz]);
  out.sort((a, b) => a[2] - b[2] || Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
  return out.slice(0, g.maxChunks).map(([dx, dz]) => key(pcx + dx, pcz + dz));
}

// A chunk in, with the player's edits to it put back (the worker has
// meshed it with them already, so nothing is left to re-mesh).
export function addChunk(g, chunk) {
  const k = key(chunk.cx, chunk.cz);
  if (g.edits[k]) {
    applyEdits(chunk, g.edits[k]);
    delete g.edits[k];
    chunk.dirty.clear();
  }
  g.world.chunks.set(k, chunk);
}

// a chunk let go of keeps its edits for when it comes back
function keepEdits(g, k, c) {
  if (c?.edits?.size) g.edits[k] = packEdits(c);
}

export function dropChunk(g, k) {
  keepEdits(g, k, g.world.chunks.get(k));
  g.world.chunks.delete(k);
}

// Lets go of the chunks more than two past the render distance; says which.
export function dropFar(g) {
  const pcx = chunkOf(Math.floor(g.player.x));
  const pcz = chunkOf(Math.floor(g.player.z));
  const far = g.renderDistance + 2;
  const gone = [];
  for (const [k, c] of g.world.chunks) {
    if (Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz)) > far) {
      keepEdits(g, k, c);
      g.world.chunks.delete(k);
      gone.push(k);
    }
  }
  return gone;
}

export function tick(g, input) {
  g.ticks++;
  g.time++;
  const p = g.player;
  const from = g.events.length;
  if (g.world.loaded(p.x, p.z)) {
    g.events.push(...stepPlayer(g.world, p, input));
    g.cursor = raycast(g.world, eyeOf(p), lookDir(p.yaw, p.pitch));
    stepHands(g, input, { onGround: p.onGround, inWater: inWater(g.world, p) });
  }
  stepUpdates(g);
  stepDrops(g);
  return g.events.slice(from);
}

export function drain(g) {
  const out = g.events;
  g.events = [];
  return out;
}
