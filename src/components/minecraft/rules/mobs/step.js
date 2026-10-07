// Minecraft, every mob's tick (EntityLiving.onLivingUpdate in order): the
// timers, fire, the mind's input, the body's travel; the dead fall over for
// 20 ticks and go, their drops already down. Only mobs in loaded chunks move.
//
// Also the player's hands on a mob (the blow under the crosshair, shears on
// a sheep) and what the save keeps of the mobs.

import { spawnDrop } from '../build.js';
import { stepFire, weaponDamage } from '../combat.js';
import { held } from '../inventory.js';
import { ITEMS } from '../items.js';
import { stepAnimal } from './animals.js';
import { stepHostile } from './hostile.js';
import { MOBS, dropsOf, hurtMob, makeMob, moveMob } from './index.js';

export function stepMobs(g) {
  const events = [];
  const keep = [];
  for (const m of g.mobs) {
    if (m.gone) continue;
    if (!g.world.loaded(m.x, m.z)) {
      keep.push(m);
      continue;
    }
    m.age++;
    if (m.hurtTime > 0) m.hurtTime--;
    if (m.invuln > 0) m.invuln--;
    if (m.swing > 0) m.swing--;
    if (m.dead) {
      // its drops on the first tick dead, whatever killed it
      if (m.deathTime === 0) for (const d of dropsOf(m, g.rand)) spawnDrop(g, d.item, d.count, m.x, m.y + 0.25, m.z);
      if (++m.deathTime <= 20) keep.push(m);
      else events.push({ type: 'mob_gone', id: m.id, x: m.x, y: m.y, z: m.z });
      moveMob(g.world, m);
      continue;
    }
    stepFire(g.world, m, (n, cause) => events.push(...hurtMob(null, m, n, { cause })));
    const input = m.dead ? { forward: 0, jump: false } : MOBS[m.kind].animal ? stepAnimal(g, m, events) : stepHostile(g, m, events);
    events.push(...moveMob(g.world, m, input));
    if (!m.gone) keep.push(m);
  }
  g.mobs = keep;
  g.events.push(...events);
}

// A blow on the mob under the crosshair: the weapon's damage, the tool's wear
// (a sword 1, another tool 2), knocked away from the player.
export function strikeMob(g, m) {
  const inv = g.inventory;
  const hand = held(inv);
  const events = hurtMob(g.player, m, weaponDamage(hand), { cause: 'player' });
  g.player.swing = 6;
  if (events.length) {
    const tool = hand && ITEMS[hand.item]?.tool;
    if (tool) {
      hand.damage += tool.type === 'sword' ? 1 : 2;
      if (hand.damage >= tool.durability) {
        inv.slots[inv.selected] = null;
        events.push({ type: 'tool_break', item: hand.item });
      }
    }
  }
  g.events.push(...events);
  return events.length > 0;
}

// Use on a mob: shears take 1 to 3 wool off an unshorn sheep. Says whether it did anything.
export function handOnMob(g, m) {
  const inv = g.inventory;
  const hand = held(inv);
  if (m.kind === 'sheep' && hand?.item === 'shears' && !m.sheared && !m.dead) {
    m.sheared = true;
    const n = 1 + Math.floor(g.rand() * 3);
    for (let i = 0; i < n; i++) spawnDrop(g, 'white_wool', 1, m.x, m.y + 1, m.z);
    hand.damage++;
    if (hand.damage >= ITEMS.shears.tool.durability) inv.slots[inv.selected] = null;
    g.events.push({ type: 'shear', id: m.id, x: m.x, y: m.y, z: m.z });
    return true;
  }
  return false;
}

// what a save keeps: the animals (monsters despawn, as the game lets them)
export const packMobs = (mobs) => mobs.filter((m) => MOBS[m.kind].animal && !m.dead).map((m) => ({ kind: m.kind, x: m.x, y: m.y, z: m.z, yaw: m.yaw, health: m.health, sheared: Boolean(m.sheared) }));
export const restoreMobs = (saved) =>
  (saved ?? [])
    .filter((s) => MOBS[s.kind])
    .map((s) => Object.assign(makeMob(s.kind, s.x, s.y, s.z), { yaw: s.yaw ?? 0, health: s.health ?? MOBS[s.kind].health, sheared: Boolean(s.sheared), fallFrom: s.y }));
