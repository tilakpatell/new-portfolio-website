// A built turret's rules: what it aims at, how fast it turns, when it fires,
// and its bolts. Every client runs every turret it holds against the ships it
// sees (its own included), so a turret needs no one to run it: a bolt at your
// own ship is yours to take, and your bolt on a turret is a hit the database
// counts (damage_entity). Pure, so it's tested.
//
//   TURRET = { range, rate, damage, turn, height, cone }; BOLT = { speed, life, reach }
//   newTurret(entity) → { id, owner, by, x, y, z, yaw, pitch, cool, fireAt: null }
//   aimTurret(turret, targets, dt, { turnless }) → the turret a frame on, fireAt
//     the target it fires at now, or null (targets: [{ id, x, y, z, vx?, vy?, vz? }])
//   muzzleOf(turret) → a bolt { p, v, life } out of its barrel
//   stepBolt(bolt, dt) → the bolt a frame on, or null once it's spent
//   boltHits(bolt, dt, { x, y, z }, reach) → whether this frame's flight passes within reach

import { forwardOf } from './flightRules';

export const TURRET = {
  range: 600, // m
  rate: 1.5, // shots a second
  damage: 8, // a bolt's, to a ship's shield (a turret's hp is the database's)
  turn: 2.0, // rad a second, on each axis
  height: 6, // m: the barrel over the turret's foot
  cone: 0.08, // rad off the target, at most, to fire
};
export const BOLT = { speed: 900, life: (TURRET.range / 900) * 1.25, reach: 8 };

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const toward = (from, to, most) => from + Math.max(-most, Math.min(most, wrap(to - from)));

export const newTurret = (e) => ({ id: e.id, owner: e.owner ?? null, by: e.metadata?.by ?? null, x: e.x, y: e.y, z: e.z, yaw: e.rot?.[1] ?? 0, pitch: 0, cool: 0, fireAt: null });

// (its owner's ship by either of the owner's names: the database's, or the room's)
const owns = (t, target) => target.id != null && (target.id === t.owner || target.id === t.by);

export function aimTurret(t, targets, dt, { turnless = false } = {}) {
  const top = t.y + TURRET.height;
  let best = null;
  let bestD = TURRET.range;
  for (const s of targets) {
    if (owns(t, s)) continue;
    const d = Math.hypot(s.x - t.x, s.y - top, s.z - t.z);
    if (d <= bestD) [best, bestD] = [s, d];
  }
  if (!best) return { ...t, cool: Math.max(0, t.cool - dt), fireAt: null };
  // where it will be when a bolt gets there
  const lead = bestD / BOLT.speed;
  const dx = best.x + (best.vx ?? 0) * lead - t.x;
  const dy = best.y + (best.vy ?? 0) * lead - top;
  const dz = best.z + (best.vz ?? 0) * lead - t.z;
  const wantYaw = Math.atan2(-dx, -dz);
  const wantPitch = Math.atan2(dy, Math.hypot(dx, dz));
  const most = turnless ? Infinity : TURRET.turn * dt;
  const yaw = toward(t.yaw, wantYaw, most);
  const pitch = toward(t.pitch, wantPitch, most);
  let cool = t.cool - dt;
  let fireAt = null;
  // (a shot due a little before this frame is due from now: never two in one frame)
  if (cool <= 1e-9 && Math.abs(wrap(wantYaw - yaw)) < TURRET.cone && Math.abs(wantPitch - pitch) < TURRET.cone) {
    fireAt = best;
    cool = Math.max(0, cool) + 1 / TURRET.rate;
  }
  return { ...t, yaw, pitch, cool: Math.max(0, cool), fireAt };
}

export function muzzleOf(t) {
  const [fx, fy, fz] = forwardOf(t);
  const out = 4; // m: the barrel's length
  return { p: [t.x + fx * out, t.y + TURRET.height + fy * out, t.z + fz * out], v: [fx * BOLT.speed, fy * BOLT.speed, fz * BOLT.speed], life: BOLT.life };
}

export function stepBolt(b, dt) {
  const life = b.life - dt;
  if (life <= 0) return null;
  return { ...b, p: [b.p[0] + b.v[0] * dt, b.p[1] + b.v[1] * dt, b.p[2] + b.v[2] * dt], life };
}

export function boltHits(b, dt, s, reach = BOLT.reach) {
  const [ax, ay, az] = b.p;
  const sx = b.v[0] * dt, sy = b.v[1] * dt, sz = b.v[2] * dt;
  const len2 = sx * sx + sy * sy + sz * sz;
  // the nearest point of this frame's flight to the target
  const k = len2 > 0 ? Math.max(0, Math.min(1, ((s.x - ax) * sx + (s.y - ay) * sy + (s.z - az) * sz) / len2)) : 0;
  return Math.hypot(ax + sx * k - s.x, ay + sy * k - s.y, az + sz * k - s.z) <= reach;
}
