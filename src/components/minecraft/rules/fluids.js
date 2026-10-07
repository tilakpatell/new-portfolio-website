// Minecraft, water and lava that flow, by the game's rules. A liquid's state
// is its level: 0 a source, 1 to 7 flowing (lava to 3), 8 falling. Each
// liquid looks again a set time after something changes near it (water
// every 5 ticks, lava every 30), so water spreads a block every quarter of a
// second and lava every second and a half.
//
// On a look a flowing cell takes the level its best neighbour gives it (one
// more than the lowest beside it, a source or a falling column counting as
// nothing), or falls (liquid above), or goes (nothing feeds it); a water
// cell between two sources over something solid becomes a source itself.
// Then it flows: straight down if it can, and only if it can't, sideways to
// one level more, as far as its reach. Water meeting a lava source makes
// obsidian; meeting flowing lava, cobblestone.
//
// stepFluid(world, x, y, z, set) does one cell's look; `set(x, y, z, id,
// level)` writes a cell and has it looked at after its liquid's delay.

import { byName } from './blocks.js';

const ID = (n) => byName.get(n).id;
export const WATER = ID('water');
export const LAVA = ID('lava');
const OBSIDIAN = ID('obsidian');
const COBBLE = ID('cobblestone');
export const FLOW = { water: { delay: 5, reach: 7 }, lava: { delay: 30, reach: 3 } };
const cfg = (id) => (id === WATER ? FLOW.water : FLOW.lava);
export const isFluid = (id) => id === WATER || id === LAVA;
export const delayOf = (id) => cfg(id).delay;

// what a liquid can flow into: air and the plants it washes away
const OPEN = new Set(['air', 'short_grass', 'fern', 'dead_bush', 'dandelion', 'poppy', 'snow', 'torch'].map(ID));

// the surface's height in sixteenths for a level: a source 14 (the game's 8/9), less as it flows
export const liquidHeight = (level) => (level >= 8 ? 16 : Math.round(((8 - level) / 9) * 16));

const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function stepFluid(world, x, y, z, set) {
  const id = world.get(x, y, z);
  if (!isFluid(id)) return;
  const { reach } = cfg(id);
  let level = world.getState(x, y, z);
  const other = id === WATER ? LAVA : WATER;

  // lava touched by water hardens where it is
  if (id === LAVA) {
    for (const [dx, dz] of SIDES)
      if (world.get(x + dx, y, z + dz) === WATER) {
        set(x, y, z, level === 0 ? OBSIDIAN : COBBLE, 0);
        return;
      }
    if (world.get(x, y + 1, z) === WATER) {
      set(x, y, z, level === 0 ? OBSIDIAN : COBBLE, 0);
      return;
    }
  }

  // a flowing cell takes what its neighbours give it
  if (level !== 0) {
    let want;
    if (world.get(x, y + 1, z) === id) want = 8;
    else {
      let best = Infinity;
      let sources = 0;
      for (const [dx, dz] of SIDES) {
        if (world.get(x + dx, y, z + dz) !== id) continue;
        const l = world.getState(x + dx, y, z + dz);
        if (l === 0) sources++;
        best = Math.min(best, l >= 8 ? 0 : l);
      }
      want = best + 1;
      const below = world.get(x, y - 1, z);
      if (id === WATER && sources >= 2 && (world.solid(x, y - 1, z) || (below === WATER && world.getState(x, y - 1, z) === 0))) want = 0;
      if (want > reach) want = null;
    }
    if (want === null) {
      set(x, y, z, 0, 0);
      return;
    }
    if (want !== level) {
      set(x, y, z, id, want);
      level = want;
    }
  }

  // flow: down if it can, else sideways one level more
  const below = world.get(x, y - 1, z);
  if (y > 0 && (OPEN.has(below) || (below === id && world.getState(x, y - 1, z) !== 0 && world.getState(x, y - 1, z) !== 8))) {
    set(x, y - 1, z, id, 8);
    return;
  }
  if (y > 0 && below === other) {
    // falling onto the other liquid: it hardens
    set(x, y - 1, z, id === WATER && world.getState(x, y - 1, z) === 0 ? OBSIDIAN : COBBLE, 0);
    return;
  }
  if (below === id && world.getState(x, y - 1, z) === 8) return;
  const next = level >= 8 ? 1 : level + 1;
  if (next > reach) return;
  for (const [dx, dz] of SIDES) {
    const nx = x + dx;
    const nz = z + dz;
    const n = world.get(nx, y, nz);
    if (OPEN.has(n)) set(nx, y, nz, id, next);
    else if (n === id) {
      const l = world.getState(nx, y, nz);
      if (l !== 0 && l !== 8 && l > next) set(nx, y, nz, id, next);
    } else if (n === other && id === WATER) set(nx, y, nz, world.getState(nx, y, nz) === 0 ? OBSIDIAN : COBBLE, 0);
  }
}
