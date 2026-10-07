// Minecraft, digging and building: what the player's hands do to the world,
// a tick at a time, by the game's rules.
//
// - Breaking: holding the button on the block under the crosshair adds the
//   tick's share of its break time (rules/breaking.js); letting go, or
//   looking at another block, starts again from nothing. A broken block
//   drops what it drops for the tool in hand, wears the tool (a sword
//   twice), and the next can't be started for five ticks, as the game paces it.
// - Placing: the held block goes against the face under the crosshair (or
//   into a cell of tall grass, which it replaces), never inside the player,
//   never past the reach; a plant only on soil; logs lie along the face's
//   axis, and a furnace, chest or pumpkin faces back at the player.
// - Falling: sand and gravel with nothing under them drop a block a tick.
// - Dropped items: little bodies on the same physics, picked up after ten
//   ticks within a block of the player, merging when they touch, gone at
//   6000 ticks (five minutes).

import { BLOCKS, byName } from './blocks.js';
import { breakTicks } from './breaking.js';
import { give, held } from './inventory.js';
import { ITEMS } from './items.js';
import { moveBox } from './physics.js';
import { REACH, normal } from './raycast.js';

export const FACING = { north: 0, south: 1, west: 2, east: 3 };
const AIR = 0;
const COOLDOWN = 5;
const PICKUP_DELAY = 10;
const DESPAWN = 6000;
const ITEM_BOX = 0.25;
const id = (n) => byName.get(n).id;
// what a placed block takes the place of, rather than going beside
const REPLACEABLE = new Set(['air', 'water', 'lava', 'short_grass', 'fern', 'dead_bush', 'snow'].map(id));
const SOIL = new Set(['grass_block', 'dirt', 'podzol', 'farmland'].map(id));
const SAND = id('sand');
const FRONTED = new Set(['furnace', 'chest', 'pumpkin', 'jack_o_lantern', 'oak_stairs'].map(id));
const LOGS = new Set(BLOCKS.filter((b) => b.name.endsWith('_log')).map((b) => b.id));

const toolOf = (s) => (s ? ITEMS[s.item]?.tool ?? null : null);

// a change to a cell: it and the one over it look again next tick (sand falls)
export function setBlock(g, x, y, z, blockId, state = 0) {
  if (!g.world.set(x, y, z, blockId, state)) return false;
  g.updates.push({ x, y, z, at: g.ticks + 1 }, { x, y: y + 1, z, at: g.ticks + 1 });
  return true;
}

export function breakBlock(g, x, y, z) {
  const blockId = g.world.get(x, y, z);
  const b = BLOCKS[blockId];
  if (!blockId || b.hardness === Infinity) return false;
  const inv = g.inventory;
  const hand = held(inv);
  const tool = toolOf(hand);
  for (const d of b.drops(g.world.getState(x, y, z), tool, g.rand)) spawnDrop(g, d.item, d.count, x + 0.5, y + 0.25, z + 0.5);
  setBlock(g, x, y, z, AIR);
  g.events.push({ type: 'break', id: blockId, x, y, z });
  if (tool && b.hardness > 0) {
    hand.damage += tool.type === 'sword' ? 2 : 1;
    if (hand.damage >= tool.durability) {
      inv.slots[inv.selected] = null;
      g.events.push({ type: 'tool_break', item: hand.item });
    }
  }
  return true;
}

export function spawnDrop(g, item, count, x, y, z) {
  const r = g.rand;
  g.drops.push({ item, count, damage: 0, x: x + (r() - 0.5) * 0.5, y, z: z + (r() - 0.5) * 0.5, vx: (r() - 0.5) * 0.2, vy: 0.2, vz: (r() - 0.5) * 0.2, age: 0 });
}

// the way the player faces, as the four sides
function facingOf(yaw) {
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  // a block faces back at whoever put it down
  if (Math.abs(fx) > Math.abs(fz)) return fx > 0 ? FACING.west : FACING.east;
  return fz > 0 ? FACING.north : FACING.south;
}

export function placeBlock(g, hit, name = held(g.inventory)?.item) {
  if (!hit || !name || hit.t >= REACH) return false;
  const it = ITEMS[name];
  if (it?.kind !== 'block') return false;
  const b = BLOCKS[it.block];
  const [nx, ny, nz] = normal(hit.face);
  let [x, y, z] = REPLACEABLE.has(g.world.get(hit.x, hit.y, hit.z)) ? [hit.x, hit.y, hit.z] : [hit.x + nx, hit.y + ny, hit.z + nz];
  if (y < 0 || y > 255 || !REPLACEABLE.has(g.world.get(x, y, z)) || !g.world.loaded(x, z)) return false;
  // never inside a body
  if (b.solid) {
    const p = g.player;
    if (x < p.x + p.w / 2 && x + 1 > p.x - p.w / 2 && z < p.z + p.w / 2 && z + 1 > p.z - p.w / 2 && y < p.y + p.h && y + 1 > p.y) return false;
  }
  // plants grow on soil; sugar cane and dead bushes on sand too, cactus on sand alone
  const below = g.world.get(x, y - 1, z);
  if (b.shape === 'cross' && !(SOIL.has(below) || ((b.name === 'sugar_cane' || b.name === 'dead_bush') && below === SAND))) return false;
  if (b.name === 'cactus' && below !== SAND) return false;
  // torches and ladders hang from a solid face, not under one
  if ((b.shape === 'torch' || b.shape === 'ladder') && (!g.world.solid(hit.x, hit.y, hit.z) || hit.face === 1)) return false;
  let state = 0;
  if (LOGS.has(b.id)) state = ny ? 0 : nx ? 1 : 2;
  else if (FRONTED.has(b.id)) state = facingOf(g.player.yaw);
  else if (b.shape === 'torch' || b.shape === 'ladder') state = hit.face;
  if (!setBlock(g, x, y, z, b.id, state)) return false;
  const inv = g.inventory;
  const s = inv.slots[inv.selected];
  if (s?.item === name) {
    s.count--;
    if (!s.count) inv.slots[inv.selected] = null;
  }
  g.events.push({ type: 'place', id: b.id, x, y, z });
  return true;
}

// one tick of the hands: the crack grows, or a block goes in
export function stepHands(g, input, { onGround, inWater }) {
  if (g.cooldown > 0) g.cooldown--;
  const hit = g.cursor;
  if (!input.attack || !hit) g.breaking = null;
  else if (g.cooldown === 0) {
    const br = g.breaking;
    if (!br || br.x !== hit.x || br.y !== hit.y || br.z !== hit.z) {
      g.breaking = { x: hit.x, y: hit.y, z: hit.z, progress: 0 };
    }
    const ticks = breakTicks(BLOCKS[hit.id], held(g.inventory)?.item ?? null, { onGround, inWater });
    if (ticks !== Infinity) {
      g.breaking.progress += ticks ? 1 / ticks : 1;
      if (g.breaking.progress >= 1 - 1e-9) {
        breakBlock(g, hit.x, hit.y, hit.z);
        g.breaking = null;
        g.cooldown = COOLDOWN;
      }
    }
  }
  if (input.use && hit) placeBlock(g, hit);
}

// the scheduled looks: sand and gravel over nothing drop a cell
export function stepUpdates(g) {
  const due = g.updates.filter((u) => u.at <= g.ticks);
  g.updates = g.updates.filter((u) => u.at > g.ticks);
  for (const { x, y, z } of due) {
    const here = g.world.get(x, y, z);
    if (!BLOCKS[here].gravity || y <= 0) continue;
    if (!REPLACEABLE.has(g.world.get(x, y - 1, z))) continue;
    const state = g.world.getState(x, y, z);
    setBlock(g, x, y, z, AIR);
    setBlock(g, x, y - 1, z, here, state);
  }
}

// the dropped items: fall, slide, merge, get picked up, go
export function stepDrops(g) {
  const p = g.player;
  const reach = { x0: p.x - p.w / 2 - 1, x1: p.x + p.w / 2 + 1, y0: p.y - 0.5, y1: p.y + p.h + 0.5, z0: p.z - p.w / 2 - 1, z1: p.z + p.w / 2 + 1 };
  const keep = [];
  for (const d of g.drops) {
    d.age++;
    if (d.age >= DESPAWN || d.count <= 0) continue;
    const r = moveBox(g.world, { x: d.x, y: d.y, z: d.z, w: ITEM_BOX, h: ITEM_BOX }, { x: d.vx, y: d.vy, z: d.vz }, { step: 0 });
    d.x = r.x;
    d.y = r.y;
    d.z = r.z;
    if (r.hitX) d.vx = 0;
    if (r.hitZ) d.vz = 0;
    if (r.dy !== d.vy) d.vy = 0;
    d.vy = (d.vy - 0.04) * 0.98;
    const slip = r.onGround ? 0.6 * 0.98 : 0.98;
    d.vx *= slip;
    d.vz *= slip;
    if (d.age >= PICKUP_DELAY && d.x > reach.x0 && d.x < reach.x1 && d.y + ITEM_BOX > reach.y0 && d.y < reach.y1 && d.z > reach.z0 && d.z < reach.z1) {
      const left = give(g.inventory, d.item, d.count, d.damage);
      if (left < d.count) g.events.push({ type: 'pickup', item: d.item, count: d.count - left });
      d.count = left;
      if (!left) continue;
    }
    keep.push(d);
  }
  // touching drops of the same thing become one
  for (let i = 0; i < keep.length; i++)
    for (let j = i + 1; j < keep.length; j++) {
      const a = keep[i];
      const b = keep[j];
      if (!a.count || !b.count || a.item !== b.item || a.damage || b.damage) continue;
      if (Math.abs(a.x - b.x) > 0.5 || Math.abs(a.y - b.y) > 0.5 || Math.abs(a.z - b.z) > 0.5) continue;
      const max = ITEMS[a.item].stack;
      const n = Math.min(b.count, max - a.count);
      a.count += n;
      b.count -= n;
    }
  g.drops = keep.filter((d) => d.count > 0);
}
