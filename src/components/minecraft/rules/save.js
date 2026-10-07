// Minecraft, the save (`tp-mc`, version 1): the seed, the clock, the player,
// the inventory and the player's edits, never the terrain, which the seed
// makes again. Edits are kept per chunk, run-length packed (rules/chunk.js),
// so an afternoon of digging is kilobytes. A save from a newer version than
// this code knows is refused, and the world starts fresh rather than wrong.

import { packEdits } from './chunk.js';
import { packMobs } from './mobs/step.js';

export const SAVE = 'tp-mc';
export const SAVE_VERSION = 1;

export function pack(g) {
  const edits = { ...g.edits };
  for (const [k, c] of g.world.chunks) if (c.edits?.size) edits[k] = packEdits(c);
  const p = g.player;
  return {
    v: SAVE_VERSION,
    seed: g.seed,
    time: g.time,
    player: { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, health: p.health, hunger: p.hunger, saturation: p.saturation, exhaustion: p.exhaustion, spawn: g.spawn, home: g.home, bed: g.bed ?? null, dead: Boolean(g.dead) },
    inventory: { slots: g.inventory.slots.map((s) => (s ? { ...s } : null)), selected: g.inventory.selected },
    edits,
    chests: g.chests ?? {},
    furnaces: g.furnaces ?? {},
    mobs: packMobs(g.mobs ?? []),
    populated: [...(g.populated ?? [])],
  };
}

// What newGame takes back, or null for a fresh world. (Phase 1 kept only
// { seed }: that is a version 1 save with nothing else in it.)
export function restore(saved) {
  if (!saved || typeof saved !== 'object' || saved.seed == null) return null;
  if ((saved.v ?? SAVE_VERSION) > SAVE_VERSION) return null;
  return {
    seed: saved.seed,
    time: saved.time,
    player: saved.player ?? null,
    inventory: saved.inventory ?? null,
    edits: saved.edits ?? {},
    chests: saved.chests ?? {},
    furnaces: saved.furnaces ?? {},
    mobs: saved.mobs ?? [],
    populated: saved.populated ?? [],
  };
}
