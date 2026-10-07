// Minecraft, blows: what the player's hand does to a mob (1.8's numbers: a
// fist 1, a sword 4 and a tool less, more by its material), and what hurts
// the player. A body hurt can't be hurt again for ten ticks unless by more
// (then by the difference), is knocked back 0.4 from whoever struck, and
// tires 0.1 (rules/hunger.js). Lava sets a body alight for 15 seconds and
// hurts 4; fire hurts a point every 20 ticks; water puts it out.

import { byName } from './blocks.js';
import { EXHAUST, exhaust } from './hunger.js';
import { ITEMS } from './items.js';

const LAVA = byName.get('lava').id;
const WATER = byName.get('water').id;
const MATERIAL = { wooden: 0, golden: 0, stone: 1, iron: 2, diamond: 3 };
const BASE = { sword: 4, axe: 3, pickaxe: 2, shovel: 1 };

// what a blow with this in hand does
export function weaponDamage(stack) {
  const it = stack && ITEMS[stack.item];
  if (it?.kind !== 'tool') return 1;
  const base = BASE[it.tool.type];
  if (base == null) return 1;
  return base + (MATERIAL[it.name.split('_')[0]] ?? 0);
}

// the player hurt, as EntityLivingBase.attackEntityFrom; says whether it landed
export function hurtPlayer(g, amount, { cause, by = null }) {
  const p = g.player;
  if (g.dead || amount <= 0) return false;
  let dealt;
  if (p.invuln > 10) {
    if (amount <= p.lastDamage) return false;
    dealt = amount - p.lastDamage;
  } else {
    dealt = amount;
    p.invuln = 20;
    p.hurtTime = 10;
  }
  p.lastDamage = amount;
  p.health = Math.max(0, p.health - dealt);
  exhaust(p, EXHAUST.hurt);
  if (by) {
    const dx = by.x - p.x;
    const dz = by.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    p.vx = p.vx / 2 - (dx / d) * 0.4;
    p.vz = p.vz / 2 - (dz / d) * 0.4;
    if (p.onGround) p.vy = Math.min(0.4, p.vy / 2 + 0.4);
  }
  g.events.push({ type: 'hurt', amount: dealt, cause });
  return true;
}

// the cells a body's box takes, any of them `id`
function touches(world, b, id) {
  for (let x = Math.floor(b.x - b.w / 2 + 0.001); x <= Math.floor(b.x + b.w / 2 - 0.001); x++)
    for (let y = Math.floor(b.y + 0.4); y <= Math.floor(b.y + b.h - 0.4); y++)
      for (let z = Math.floor(b.z - b.w / 2 + 0.001); z <= Math.floor(b.z + b.w / 2 - 0.001); z++) if (world.get(x, y, z) === id) return true;
  return false;
}

// One tick of fire for a body (the player or a mob): lava lights it and
// hurts 4, fire hurts 1 every 20 ticks, water puts it out. `hurt(n, cause)` does the hurting.
export function stepFire(world, b, hurt) {
  if (touches(world, b, WATER)) b.fire = 0;
  if (touches(world, b, LAVA)) {
    hurt(4, 'lava');
    b.fire = Math.max(b.fire ?? 0, 300);
  }
  if (b.fire > 0) {
    if (b.fire % 20 === 0) hurt(1, 'fire');
    b.fire--;
  }
}

