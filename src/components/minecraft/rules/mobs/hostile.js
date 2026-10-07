// Minecraft, the monsters' minds (1.12's tasks):
//
// - Noticing: once in ten ticks, the player within its range (zombie 35,
//   the rest 16, an enderman only once stared at) and in sight; given up
//   past the range, or when the player dies. A blow makes any of them turn.
// - Zombie: walks up (EntityAIAttackMelee) and strikes for 3 within reach
//   ((2 × its width)² + the player's width, squared), at most once in 20 ticks.
// - Skeleton: comes within 15, stops once it has seen the player a second,
//   draws its bow 20 ticks and looses an arrow at 1.6 (spread 6 on normal),
//   every 40 ticks; the arrow falls 0.05 a tick, keeps 0.99, and hurts
//   ⌈its speed × about 2.2⌉.
// - Creeper: walks up, and within 3 swells (a tick a tick, shrinking again
//   past 7 or out of sight); at 30 it explodes at power 3.
// - Spider: hunts only in the dark (brightness under 0.5; in light it may
//   lose interest, 1 in 100 a tick), strikes for 2, leaps (0.4) from 2 to 4
//   off, climbs walls.
// - Enderman: minds its own until looked in the eye (within 64), then
//   strikes for 7; teleports out of water and the sun.
// - Zombies and skeletons burn in daylight under the open sky.

import { hurtPlayer } from '../combat.js';
import { explode } from '../explosion.js';
import { skyDarken } from '../time.js';
import { look, swim, walkTo, wander, speedOf } from './ai.js';
import { MOBS, eyeOf, sees, yawTo } from './index.js';

const CREEPER_FUSE = 30;
const SQ = (x) => x * x;

// how bright a cell looks to a mob (the overworld's brightness table over its light)
export function brightness(g, x, y, z) {
  const l = g.world.light(x, y, z);
  const level = Math.max((l >> 4) - skyDarken(g.time), l & 15);
  const f = 1 - level / 15;
  return (1 - f) / (f * 3 + 1);
}
export const isDay = (g) => skyDarken(g.time) < 4;
const underSky = (g, x, y, z) => g.world.light(x, y, z) >> 4 === 15;

const playerEye = (g) => ({ x: g.player.x, y: g.player.y + 1.62, z: g.player.z });
const mobEye = (m) => ({ x: m.x, y: eyeOf(m), z: m.z });

// the sun on an undead head: alight for 8 seconds, now and then
function sunburn(g, m) {
  if (!isDay(g) || m.inWater) return;
  const b = brightness(g, m.x, eyeOf(m), m.z);
  if (b > 0.5 && g.rand() * 30 < (b - 0.4) * 2 && underSky(g, m.x, eyeOf(m), m.z)) m.fire = Math.max(m.fire, 160);
}

function notice(g, m, range) {
  const a = m.ai;
  const p = g.player;
  const d = Math.hypot(p.x - m.x, p.y - m.y, p.z - m.z);
  if (g.dead || d > range * 1.2) a.target = null;
  if (a.hurtBy === 'player' && !g.dead) a.target = 'player';
  if (!a.target && g.rand() < 0.1 && d <= range && sees(g.world, mobEye(m), playerEye(g))) a.target = 'player';
  return a.target ? d : null;
}

// a blow in reach, once in 20 ticks
function strike(g, m, damage) {
  const a = m.ai;
  const p = g.player;
  a.cooldown = Math.max(0, (a.cooldown ?? 0) - 1);
  const reach = SQ(m.w * 2) + p.w;
  if (SQ(p.x - m.x) + SQ(p.y - m.y) + SQ(p.z - m.z) <= reach && a.cooldown <= 0) {
    a.cooldown = 20;
    m.swing = 6;
    hurtPlayer(g, damage, { cause: m.kind, by: m });
  }
}

function chase(g, m, modifier = 1) {
  const p = g.player;
  look.at(m, yawTo(m.x, m.z, p.x, p.z), Math.atan2(p.y + 1.62 - eyeOf(m), Math.hypot(p.x - m.x, p.z - m.z) || 1));
  return walkTo(g, m, p.x, p.z, speedOf(m, modifier), { near: 0.2, careful: false }) ?? { forward: 0, jump: false };
}

function idle(g, m) {
  const go = wander(g, m, speedOf(m));
  look(g, m);
  return go ?? { forward: 0, jump: false };
}

export function stepHostile(g, m, events) {
  const a = m.ai;
  const t = MOBS[m.kind];
  const jump = swim(g, m);
  if (t.burns) sunburn(g, m);
  if (a.still) return { forward: 0, jump };
  let go;
  switch (m.kind) {
    case 'zombie':
      go = notice(g, m, t.range) != null ? chase(g, m) : idle(g, m);
      if (a.target) strike(g, m, t.attack);
      break;
    case 'spider': {
      const dark = brightness(g, m.x, m.y + 0.5, m.z) < 0.5;
      if (!dark && a.target && a.hurtBy !== 'player' && g.rand() < 0.01) a.target = null;
      const d = dark || a.target || a.hurtBy === 'player' ? notice(g, m, t.range) : null;
      if (d == null) {
        go = idle(g, m);
        break;
      }
      go = chase(g, m);
      const p = g.player;
      if (d >= 2 && d <= 4 && m.onGround && g.rand() < 0.2) {
        const dx = p.x - m.x;
        const dz = p.z - m.z;
        const h = Math.hypot(dx, dz) || 1;
        m.vx += (dx / h) * 0.4 * 0.8 + m.vx * 0.2;
        m.vz += (dz / h) * 0.4 * 0.8 + m.vz * 0.2;
        m.vy = 0.4;
      }
      strike(g, m, t.attack);
      break;
    }
    case 'skeleton':
      go = archer(g, m, events);
      break;
    case 'creeper':
      go = creeper(g, m, events);
      break;
    case 'enderman':
      go = enderman(g, m, events);
      break;
    default:
      go = idle(g, m);
  }
  return { forward: go.forward, jump: go.jump || jump };
}

function archer(g, m, events) {
  const a = m.ai;
  const d = notice(g, m, MOBS.skeleton.range);
  if (d == null) {
    a.drawing = null;
    return idle(g, m);
  }
  const seen = sees(g.world, mobEye(m), playerEye(g));
  a.seeTime = seen ? Math.max(0, a.seeTime ?? 0) + 1 : Math.min(0, a.seeTime ?? 0) - 1;
  a.cooldown = Math.max(0, (a.cooldown ?? 0) - 1);
  let go = chase(g, m);
  if (d <= 15 && a.seeTime >= 20) go = { forward: 0, jump: false };
  // the bow: drawn 20 ticks, loosed, and again 40 ticks on
  if (a.drawing == null && a.cooldown <= 0 && a.seeTime >= -60) a.drawing = 0;
  if (a.drawing != null) {
    if (!seen && a.seeTime < -60) a.drawing = null;
    else if (seen && ++a.drawing >= 20) {
      shoot(g, m);
      events.push({ type: 'bow', id: m.id, x: m.x, y: m.y, z: m.z });
      a.drawing = null;
      a.cooldown = 40;
    }
  }
  return go;
}

// gaussian, from the world's dice
function gauss(rand) {
  let u = 0;
  while (u === 0) u = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

// EntitySkeleton.attackEntityWithRangedAttack, then EntityArrow.shoot
function shoot(g, m) {
  const p = g.player;
  const x = m.x;
  const y = m.y + 1.74 - 0.1;
  const z = m.z;
  const dx = p.x - x;
  const dy = p.y + p.h / 3 - y;
  const dz = p.z - z;
  const flat = Math.hypot(dx, dz);
  let vx = dx;
  let vy = dy + flat * 0.2;
  let vz = dz;
  const len = Math.hypot(vx, vy, vz) || 1;
  const spread = 0.0075 * (14 - 2 * 4);
  vx = (vx / len + gauss(g.rand) * spread) * 1.6;
  vy = (vy / len + gauss(g.rand) * spread) * 1.6;
  vz = (vz / len + gauss(g.rand) * spread) * 1.6;
  g.arrows.push({ x, y, z, vx, vy, vz, damage: 2 + gauss(g.rand) * 0.25 + 2 * 0.11, age: 0, stuck: false, from: m.kind });
}

// The arrows in flight: a step of their speed, stuck in what they hit, a
// player struck for ⌈speed × damage⌉; stuck ones go after a minute.
export function stepArrows(g) {
  const p = g.player;
  const keep = [];
  for (const ar of g.arrows) {
    ar.age++;
    if (ar.stuck) {
      if (ar.age < 1200) keep.push(ar);
      continue;
    }
    const speed = Math.hypot(ar.vx, ar.vy, ar.vz);
    const n = Math.max(1, Math.ceil(speed / 0.25));
    let hit = null;
    for (let i = 1; i <= n && !hit; i++) {
      const x = ar.x + (ar.vx * i) / n;
      const y = ar.y + (ar.vy * i) / n;
      const z = ar.z + (ar.vz * i) / n;
      if (!g.dead && Math.abs(x - p.x) < p.w / 2 + 0.3 && y > p.y - 0.3 && y < p.y + p.h + 0.3 && Math.abs(z - p.z) < p.w / 2 + 0.3) hit = 'player';
      else if (g.world.solid(x, y, z)) hit = { x, y, z };
    }
    if (hit === 'player') {
      hurtPlayer(g, Math.ceil(speed * ar.damage), { cause: ar.from, by: { x: ar.x - ar.vx, z: ar.z - ar.vz } });
      continue;
    }
    if (hit) {
      Object.assign(ar, { x: hit.x - ar.vx * 0.05, y: hit.y - ar.vy * 0.05, z: hit.z - ar.vz * 0.05, stuck: true, age: 0 });
      keep.push(ar);
      continue;
    }
    ar.x += ar.vx;
    ar.y += ar.vy;
    ar.z += ar.vz;
    const wet = g.world.get(ar.x, ar.y, ar.z) === 0 ? 0.99 : 0.99;
    ar.vx *= wet;
    ar.vy = ar.vy * wet - 0.05;
    ar.vz *= wet;
    if (ar.age < 1200 && ar.y > -64) keep.push(ar);
  }
  g.arrows = keep;
}

function creeper(g, m, events) {
  const a = m.ai;
  const d = notice(g, m, MOBS.creeper.range);
  a.fuse ??= 0;
  const seen = d != null && sees(g.world, mobEye(m), playerEye(g));
  const close = d != null && seen && d * d < 9;
  if (close || (a.fuse > 0 && d != null && d * d <= 49 && seen)) {
    if (a.fuse === 0) events.push({ type: 'hiss', id: m.id, x: m.x, y: m.y, z: m.z });
    a.fuse++;
    if (a.fuse >= CREEPER_FUSE) {
      m.gone = true;
      explode(g, m.x, m.y + m.h / 2, m.z, 3, { by: 'creeper' });
    }
    look.at(m, yawTo(m.x, m.z, g.player.x, g.player.z), 0);
    return { forward: 0, jump: false };
  }
  a.fuse = Math.max(0, a.fuse - 1);
  return d != null ? chase(g, m) : idle(g, m);
}

function enderman(g, m, events) {
  const a = m.ai;
  const p = g.player;
  // out of water and the sun, anywhere else
  if (m.inWater || (isDay(g) && brightness(g, m.x, eyeOf(m), m.z) > 0.5 && underSky(g, m.x, eyeOf(m), m.z) && g.rand() * 30 < (brightness(g, m.x, eyeOf(m), m.z) - 0.4) * 2)) {
    if (teleport(g, m, events)) a.target = null;
  }
  // looked in the eye
  if (!a.target && !g.dead) {
    const e = playerEye(g);
    const to = { x: m.x - e.x, y: m.y + 2.55 - e.y, z: m.z - e.z };
    const d = Math.hypot(to.x, to.y, to.z);
    const lx = -Math.sin(p.yaw) * Math.cos(p.pitch);
    const ly = Math.sin(p.pitch);
    const lz = -Math.cos(p.yaw) * Math.cos(p.pitch);
    if (d < 64 && (lx * to.x + ly * to.y + lz * to.z) / d > 1 - 0.025 / d && sees(g.world, e, { x: m.x, y: m.y + 2.55, z: m.z })) {
      a.target = 'player';
      events.push({ type: 'stare', id: m.id, x: m.x, y: m.y, z: m.z });
    }
  }
  if (a.hurtBy === 'player') a.target = 'player';
  if (!a.target || g.dead) return idle(g, m);
  const go = chase(g, m, 1.5);
  strike(g, m, MOBS.enderman.attack);
  return go;
}

// EntityEnderman.teleportRandomly: somewhere within 32 across and up or down, on the ground, dry
export function teleport(g, m, events) {
  for (let i = 0; i < 16; i++) {
    const x = m.x + (g.rand() - 0.5) * 64;
    const z = m.z + (g.rand() - 0.5) * 64;
    let y = Math.floor(m.y + Math.floor(g.rand() * 64) - 32);
    if (!g.world.loaded(x, z)) continue;
    while (y > 1 && !g.world.solid(x, y - 1, z)) y--;
    if (y <= 1 || g.world.solid(x, y, z) || g.world.solid(x, y + 1, z) || g.world.solid(x, y + 2, z)) continue;
    if (g.world.get(x, y, z) !== 0) continue;
    events.push({ type: 'teleport', id: m.id, x: m.x, y: m.y, z: m.z });
    Object.assign(m, { x: Math.floor(x) + 0.5, y, z: Math.floor(z) + 0.5, vx: 0, vy: 0, vz: 0, fallFrom: y });
    return true;
  }
  return false;
}
