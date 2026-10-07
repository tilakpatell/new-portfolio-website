// Minecraft, the player: one 20 Hz tick of walking, jumping, swimming and
// climbing, by the game's own numbers (EntityLivingBase's travel, 1.12):
//
// - On the ground the body takes 0.1 × 0.98 of the input a tick and keeps
//   0.546 of its speed (the block's slipperiness 0.6 × the air's 0.91), so it
//   settles at 0.21585 blocks a tick, 4.317 a second; sprinting is × 1.3
//   (5.612), sneaking the input × 0.3 (1.295). In the air it steers with
//   0.02 and keeps 0.91.
// - A jump starts at 0.42 up; each tick falls by 0.08 and keeps 0.98, which
//   peaks 1.2522 blocks up. A sprint jump throws the body 0.2 forward.
// - In water: 0.02 to steer, 0.8 kept every way, 0.02 down a tick, 0.04 up
//   while jump is held; 300 ticks of air, then 2 hurt every 20 ticks.
// - On a ladder: no more than 0.15 a tick across or down; walking into the
//   wall sets 0.2 up, which climbs at 2.35 m/s.
// - A fall hurts one half-heart a block past three.
// - Moving tires (rules/hunger.js): a metre sprinted on the ground 0.1, swum
//   0.01, a jump 0.05 (0.2 sprinting), a hurt 0.1.
//
// yaw 0 faces north (−z) and turns left as it grows, as three.js turns.

import { EXHAUST, exhaust } from './hunger.js';
import { eyeInWater, inWater, moveBox, onLadder } from './physics.js';

export const EYE = { stand: 1.62, sneak: 1.27 };
export const SIZE = { w: 0.6, h: 1.8 };
const SPEED = 0.1;
const GROUND_SLIP = 0.6 * 0.91;
const STEP_EVERY = 1.3;

export function makePlayer({ x, y, z }) {
  return { x, y, z, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, w: SIZE.w, h: SIZE.h, onGround: false, sneak: false, sprint: false, health: 20, hunger: 20, saturation: 5, exhaustion: 0, foodTimer: 0, air: 300, fallFrom: y, walked: 0, nextStep: STEP_EVERY, swing: 0, inWater: false };
}

// the input, turned by the yaw and added to the speed
function steer(p, strafe, forward, accel) {
  let len = Math.hypot(strafe, forward);
  if (len < 1e-4) return;
  len = Math.max(1, len);
  const s = (strafe * accel) / len;
  const f = (forward * accel) / len;
  const sin = Math.sin(p.yaw);
  const cos = Math.cos(p.yaw);
  p.vx += s * cos - f * sin;
  p.vz += -s * sin - f * cos;
}

export function stepPlayer(world, p, input) {
  const events = [];
  p.yaw = input.yaw ?? p.yaw;
  p.pitch = input.pitch ?? p.pitch;
  p.sneak = Boolean(input.sneak);
  p.sprint = Boolean(input.sprint) && input.forward > 0 && !p.sneak;
  const box = { x: p.x, y: p.y, z: p.z, w: p.w, h: p.h };
  const wet = inWater(world, box);
  const ladder = onLadder(world, box);
  p.inWater = wet;

  const scale = 0.98 * (p.sneak ? 0.3 : 1);
  const strafe = (input.strafe ?? 0) * scale;
  const forward = (input.forward ?? 0) * scale;

  if (input.jump) {
    if (wet) p.vy += 0.04;
    else if (p.onGround) {
      p.vy = 0.42;
      exhaust(p, p.sprint ? EXHAUST.sprintJump : EXHAUST.jump);
      if (p.sprint) {
        p.vx -= Math.sin(p.yaw) * 0.2;
        p.vz -= Math.cos(p.yaw) * 0.2;
      }
    }
  }

  let slip = 0.91;
  if (wet) steer(p, strafe, forward, 0.02);
  else {
    if (p.onGround) slip = GROUND_SLIP;
    const speed = SPEED * (p.sprint ? 1.3 : 1);
    steer(p, strafe, forward, p.onGround ? (speed * 0.16277136) / slip ** 3 : p.sprint ? 0.026 : 0.02);
  }
  if (ladder) {
    p.vx = Math.max(-0.15, Math.min(0.15, p.vx));
    p.vz = Math.max(-0.15, Math.min(0.15, p.vz));
    p.vy = Math.max(-0.15, p.vy);
    if (p.sneak && p.vy < 0) p.vy = 0;
  }

  const was = { x: p.x, y: p.y, z: p.z, onGround: p.onGround };
  const r = moveBox(world, box, { x: p.vx, y: p.vy, z: p.vz }, { onGround: p.onGround, sneak: p.sneak });
  p.x = r.x;
  p.y = r.y;
  p.z = r.z;
  if (r.hitX) p.vx = 0;
  if (r.hitZ) p.vz = 0;
  if (r.dy !== p.vy) p.vy = 0;
  p.onGround = r.onGround;
  // the way gone, in whole centimetres, as the game counts it
  const cm = (d) => Math.round(d * 100) * 0.01;
  if (wet) exhaust(p, EXHAUST.swim * cm(Math.hypot(p.x - was.x, p.y - was.y, p.z - was.z)));
  else if (p.onGround && p.sprint) exhaust(p, EXHAUST.sprint * cm(Math.hypot(p.x - was.x, p.z - was.z)));

  // the fall, measured from the highest point since the feet left the ground
  if (wet || ladder) p.fallFrom = p.y;
  else if (!p.onGround) p.fallFrom = Math.max(p.fallFrom, p.y);
  if (p.onGround && !was.onGround) {
    const fell = p.fallFrom - p.y;
    events.push({ type: 'land', fell });
    const hurt = Math.floor(fell - 3 + 1e-9);
    if (hurt > 0) {
      p.health = Math.max(0, p.health - hurt);
      exhaust(p, EXHAUST.hurt);
      events.push({ type: 'hurt', amount: hurt, cause: 'fall' });
    }
  }
  if (p.onGround) p.fallFrom = p.y;

  if ((r.hitX || r.hitZ) && ladder) p.vy = 0.2;
  if (wet) {
    p.vx *= 0.8;
    p.vy = p.vy * 0.8 - 0.02;
    p.vz *= 0.8;
    // at a bank, hop out as the game lets a swimmer
    if ((r.hitX || r.hitZ) && input.jump) p.vy = 0.3;
  } else {
    p.vy = (p.vy - 0.08) * 0.98;
    p.vx *= slip;
    p.vz *= slip;
  }

  // breath
  if (eyeInWater(world, p.x, p.y + (p.sneak ? EYE.sneak : EYE.stand), p.z)) {
    p.air--;
    if (p.air <= -20) {
      p.air = 0;
      p.health = Math.max(0, p.health - 2);
      exhaust(p, EXHAUST.hurt);
      events.push({ type: 'hurt', amount: 2, cause: 'drown' });
    }
  } else p.air = Math.min(300, p.air + 4);

  // a footstep every 1.3 blocks walked on the ground
  if (p.onGround) {
    p.walked += Math.hypot(p.x - was.x, p.z - was.z);
    if (p.walked >= p.nextStep) {
      p.nextStep = p.walked + STEP_EVERY;
      events.push({ type: 'step' });
    }
  }
  if (p.swing > 0) p.swing--;
  return events;
}

export const eyeOf = (p) => ({ x: p.x, y: p.y + (p.sneak ? EYE.sneak : EYE.stand), z: p.z });
