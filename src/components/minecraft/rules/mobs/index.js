// Minecraft, the mobs: their numbers (1.12's sizes, health, speed attribute,
// attack), a body that moves on the player's physics, being hurt and dying,
// and what they drop. Each kind's mind is in animals.js or hostile.js; this
// file steps them all a tick at a time (`stepMobs`), as EntityLiving does:
// the AI sets where to go and how fast, the body travels, fire burns, the
// far ones despawn, the dead fall over for 20 ticks and go.
//
// A mob is { id, kind, x, y, z, vx, vy, vz, yaw, headYaw, pitch, w, h,
// health, onGround, hurtTime, invuln, deathTime, fire, ai: {…} }.

import { inWater, moveBox } from '../physics.js';

// the game's numbers: size in blocks, health, movement speed (the attribute),
// melee damage, how far it notices the player, whether it's hostile
export const MOBS = {
  pig: { w: 0.9, h: 0.9, health: 10, speed: 0.25, animal: true },
  cow: { w: 0.9, h: 1.4, health: 10, speed: 0.2, animal: true },
  sheep: { w: 0.9, h: 1.3, health: 8, speed: 0.23, animal: true },
  chicken: { w: 0.4, h: 0.7, health: 4, speed: 0.25, animal: true },
  zombie: { w: 0.6, h: 1.95, health: 20, speed: 0.23, attack: 3, range: 35, burns: true },
  skeleton: { w: 0.6, h: 1.99, health: 20, speed: 0.25, range: 16, burns: true },
  creeper: { w: 0.6, h: 1.7, health: 20, speed: 0.25, range: 16 },
  spider: { w: 1.4, h: 0.9, health: 16, speed: 0.3, attack: 2, range: 16, climbs: true },
  enderman: { w: 0.6, h: 2.9, health: 40, speed: 0.3, attack: 7, range: 64 },
};
// eyes, as the game puts them (0.85 of the height)
export const eyeOf = (m) => m.y + m.h * 0.85;

let next = 1;
export function makeMob(kind, x, y, z, rand = Math.random) {
  const t = MOBS[kind];
  return { id: next++, kind, x, y, z, vx: 0, vy: 0, vz: 0, yaw: rand() * Math.PI * 2, headYaw: 0, pitch: 0, w: t.w, h: t.h, health: t.health, onGround: false, fallFrom: y, hurtTime: 0, invuln: 0, deathTime: 0, fire: 0, age: 0, idle: 0, walked: 0, ai: {} };
}

// what a mob drops when it dies (the loot tables, nothing for looting)
const some = (rand, a, b) => a + Math.floor(rand() * (b - a + 1));
export function dropsOf(m, rand) {
  const out = [];
  const add = (item, n) => n > 0 && out.push({ item, count: n });
  const cooked = m.fire > 0;
  switch (m.kind) {
    case 'pig':
      add(cooked ? 'cooked_porkchop' : 'porkchop', some(rand, 1, 3));
      break;
    case 'cow':
      add('leather', some(rand, 0, 2));
      add(cooked ? 'cooked_beef' : 'beef', some(rand, 1, 3));
      break;
    case 'sheep':
      if (!m.sheared) add('white_wool', 1);
      add(cooked ? 'cooked_mutton' : 'mutton', some(rand, 1, 2));
      break;
    case 'chicken':
      add('feather', some(rand, 0, 2));
      add(cooked ? 'cooked_chicken' : 'chicken', 1);
      break;
    case 'zombie':
      add('rotten_flesh', some(rand, 0, 2));
      if (rand() < 0.025) add('iron_ingot', 1);
      break;
    case 'skeleton':
      add('arrow', some(rand, 0, 2));
      add('bone', some(rand, 0, 2));
      break;
    case 'creeper':
      add('gunpowder', some(rand, 0, 2));
      break;
    case 'spider':
      add('string', some(rand, 0, 2));
      break;
    case 'enderman':
      add('ender_pearl', some(rand, 0, 1));
      break;
    default:
  }
  return out;
}

// One tick of a body, as EntityLivingBase.travel: the AI's forward speed
// along the yaw, a jump, water, gravity, the ground's grip; a spider climbs
// what it walks into, a chicken flaps down slowly.
export function moveMob(world, m, { forward = 0, jump = false } = {}) {
  const box = { x: m.x, y: m.y, z: m.z, w: m.w, h: m.h };
  const wet = inWater(world, box);
  if (jump) {
    if (wet) m.vy += 0.04;
    else if (m.onGround) m.vy = 0.42;
  }
  const slip = m.onGround ? 0.6 * 0.91 : 0.91;
  const f = forward * 0.98;
  if (Math.abs(f) > 1e-4) {
    // the AI's forward is its speed, and so is its push (setAIMoveSpeed sets both):
    // on the ground speed × forward × the grip's factor, in air or water 0.02 × forward
    const accel = m.onGround && !wet ? (f * forward * 0.16277136) / slip ** 3 : f * 0.02;
    m.vx += -Math.sin(m.yaw) * accel;
    m.vz += -Math.cos(m.yaw) * accel;
  }
  const was = { x: m.x, z: m.z, onGround: m.onGround };
  const r = moveBox(world, box, { x: m.vx, y: m.vy, z: m.vz }, { onGround: m.onGround });
  m.x = r.x;
  m.y = r.y;
  m.z = r.z;
  m.hitWall = r.hitX || r.hitZ;
  if (r.hitX) m.vx = 0;
  if (r.hitZ) m.vz = 0;
  if (r.dy !== m.vy) m.vy = 0;
  m.onGround = r.onGround;
  const events = [];
  if (wet) m.fallFrom = m.y;
  else if (!m.onGround) m.fallFrom = Math.max(m.fallFrom, m.y);
  if (m.onGround && !was.onGround && m.kind !== 'chicken') {
    const hurt = Math.floor(m.fallFrom - m.y - 3 + 1e-9);
    if (hurt > 0) events.push(...hurtMob(null, m, hurt, { cause: 'fall' }));
  }
  if (m.onGround) m.fallFrom = m.y;
  if (MOBS[m.kind].climbs && m.hitWall) m.vy = 0.2;
  if (wet) {
    m.vx *= 0.8;
    m.vy = m.vy * 0.8 - 0.02;
    m.vz *= 0.8;
  } else {
    m.vy = (m.vy - 0.08) * 0.98;
    if (m.kind === 'chicken' && !m.onGround && m.vy < 0) m.vy *= 0.6;
    m.vx *= slip;
    m.vz *= slip;
  }
  m.walked += Math.hypot(m.x - was.x, m.z - was.z);
  m.inWater = wet;
  return events;
}

// Hurt, as EntityLivingBase.attackEntityFrom: no more than once in ten ticks
// (a bigger blow in that time does the difference), red for ten ticks,
// knocked back 0.4 from whoever struck. Says what happened.
export function hurtMob(by, m, amount, { cause = 'player', knock = 0.4 } = {}) {
  if (m.dead || amount <= 0) return [];
  if (m.invuln > 10) {
    if (amount <= m.lastDamage) return [];
    m.health -= amount - m.lastDamage;
    m.lastDamage = amount;
  } else {
    m.health -= amount;
    m.lastDamage = amount;
    m.invuln = 20;
    m.hurtTime = 10;
  }
  if (by && knock) {
    const dx = by.x - m.x;
    const dz = by.z - m.z;
    const d = Math.hypot(dx, dz) || 1;
    m.vx = m.vx / 2 - (dx / d) * knock;
    m.vz = m.vz / 2 - (dz / d) * knock;
    if (m.onGround) m.vy = Math.min(0.4, m.vy / 2 + 0.4);
  }
  m.ai.hurtBy = by ? 'player' : m.ai.hurtBy;
  m.ai.panic = MOBS[m.kind].animal && by ? 1 : m.ai.panic;
  const events = [{ type: 'mob_hurt', id: m.id, kind: m.kind, cause, x: m.x, y: m.y, z: m.z }];
  if (m.health <= 0) {
    m.dead = true;
    m.health = 0;
    events.push({ type: 'mob_die', id: m.id, kind: m.kind, x: m.x, y: m.y, z: m.z, byPlayer: cause === 'player' });
  }
  return events;
}

// The nearest living mob along the eye's line within reach (the player's
// 3 for a blow), with how far: { mob, t } or null.
export function pickMob(mobs, eye, dir, reach = 3) {
  let best = null;
  for (const m of mobs) {
    if (m.dead) continue;
    const g = 0.1; // the game grows the box a little to make it easier to hit
    const lo = [m.x - m.w / 2 - g, m.y - g, m.z - m.w / 2 - g];
    const hi = [m.x + m.w / 2 + g, m.y + m.h + g, m.z + m.w / 2 + g];
    const o = [eye.x, eye.y, eye.z];
    const d = [dir.x, dir.y, dir.z];
    let t0 = 0;
    let t1 = reach;
    let ok = true;
    for (let i = 0; i < 3 && ok; i++) {
      if (Math.abs(d[i]) < 1e-9) {
        if (o[i] < lo[i] || o[i] > hi[i]) ok = false;
        continue;
      }
      let a = (lo[i] - o[i]) / d[i];
      let b = (hi[i] - o[i]) / d[i];
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
      if (t0 > t1) ok = false;
    }
    if (ok && (!best || t0 < best.t)) best = { mob: m, t: t0 };
  }
  return best;
}

// Whether a line between two points is clear of anything solid (canEntityBeSeen)
export function sees(world, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const n = Math.ceil(Math.hypot(dx, dy, dz) / 0.25);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (world.solid(a.x + dx * t, a.y + dy * t, a.z + dz * t)) return false;
  }
  return true;
}

// the yaw that looks from (x, z) toward (tx, tz), in the player's convention
export const yawTo = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));
// turned toward a yaw by no more than `max` a tick (EntityMoveHelper's 90°, the head's 10°)
export function turnToward(from, to, max) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return from + Math.max(-max, Math.min(max, d));
}
