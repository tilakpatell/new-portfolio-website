// Minecraft, the mobs' shared habits, as the game's AI tasks: walking to a
// place (EntityMoveHelper: turn up to 90° a tick toward it, go at the speed
// asked, jump at a step it walks into, never off a drop of more than 3),
// wandering (EntityAIWander: one chance in 120 a tick to set off for a spot
// within 10), watching the player (EntityAIWatchClosest: within 8, a chance
// of 0.02 a tick, for 40 to 80 ticks), looking about (EntityAILookIdle),
// and swimming (EntityAISwimming: in water, a jump 8 ticks in 10).
//
// A step returns the body's input for the tick: { forward, jump }.

import { MOBS, eyeOf, turnToward, yawTo } from './index.js';

const RIGHT_ANGLE = Math.PI / 2;
const HEAD_TURN = (10 * Math.PI) / 180;

// how far the ground falls ahead of a body walking this way
function dropAhead(world, m) {
  const x = m.x - Math.sin(m.yaw) * (m.w / 2 + 0.5);
  const z = m.z - Math.cos(m.yaw) * (m.w / 2 + 0.5);
  const y = Math.floor(m.y);
  if (world.solid(x, y, z)) return 0;
  for (let d = 1; d <= 4; d++) if (world.solid(x, y - d, z)) return d - 1;
  return 4;
}

// toward (tx, tz) at `speed` (the attribute × the task's modifier); says the input, or null once there
export function walkTo(g, m, tx, tz, speed, { near = 0.5, careful = true } = {}) {
  const d = Math.hypot(tx - m.x, tz - m.z);
  if (d < near) return null;
  m.yaw = turnToward(m.yaw, yawTo(m.x, m.z, tx, tz), RIGHT_ANGLE);
  if (careful && dropAhead(g.world, m) > 3) return null;
  return { forward: speed, jump: Boolean(m.hitWall && m.onGround) };
}

// a spot to wander to: within 10 across and 7 up or down, on something, with room
export function wanderSpot(g, m, r = 10, up = 7) {
  const rand = g.rand;
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(m.x + (rand() * 2 - 1) * r);
    const z = Math.floor(m.z + (rand() * 2 - 1) * r);
    const y0 = Math.floor(m.y);
    for (let dy = up; dy >= -up; dy--) {
      const y = y0 + dy;
      if (g.world.solid(x, y - 1, z) && !g.world.solid(x, y, z) && !g.world.solid(x, y + 1, z)) return { x: x + 0.5, y, z: z + 0.5 };
    }
  }
  return null;
}

// EntityAIWander: wander off now and then; says the input while going
export function wander(g, m, speed, chance = 1 / 120) {
  const a = m.ai;
  if (!a.walk && g.rand() < chance) {
    const s = wanderSpot(g, m);
    if (s) a.walk = { ...s, until: g.ticks + 100 };
  }
  if (!a.walk) return null;
  const go = walkTo(g, m, a.walk.x, a.walk.z, speed);
  if (!go || g.ticks > a.walk.until) {
    a.walk = null;
    return null;
  }
  return go;
}

// the head: on the player within 8 now and then, or about; turned 10° a tick
export function look(g, m) {
  const a = m.ai;
  const p = g.player;
  const d = Math.hypot(p.x - m.x, p.z - m.z);
  if (!a.lookFor && g.rand() < 0.02) {
    if (d < 8 && !g.dead) a.lookFor = { at: 'player', ticks: 40 + Math.floor(g.rand() * 40) };
    else a.lookFor = { at: m.yaw + (g.rand() * 2 - 1) * Math.PI, ticks: 20 + Math.floor(g.rand() * 20) };
  }
  let want = m.yaw;
  let pitch = 0;
  if (a.lookFor) {
    if (a.lookFor.at === 'player') {
      want = yawTo(m.x, m.z, p.x, p.z);
      pitch = Math.atan2(p.y + 1.62 - eyeOf(m), d || 1);
    } else want = a.lookFor.at;
    if (--a.lookFor.ticks <= 0) a.lookFor = null;
  }
  look.at(m, want, pitch);
}
// the head turned toward a yaw and pitch, no more than 75° off the body
look.at = (m, yaw, pitch) => {
  const abs = turnToward(m.yaw + m.headYaw, yaw, HEAD_TURN);
  let rel = abs - m.yaw;
  while (rel > Math.PI) rel -= Math.PI * 2;
  while (rel < -Math.PI) rel += Math.PI * 2;
  m.headYaw = Math.max(-1.3, Math.min(1.3, rel));
  m.pitch += Math.max(-HEAD_TURN, Math.min(HEAD_TURN, pitch - m.pitch));
};

// in water, kick up (EntityAISwimming)
export const swim = (g, m) => Boolean(m.inWater && g.rand() < 0.8);

export const speedOf = (m, modifier = 1) => MOBS[m.kind].speed * modifier;
