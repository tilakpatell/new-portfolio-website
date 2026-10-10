// A 2017 soldier's rulebook row (src/data/bf2017/physics/soldier.json,
// read from the game's CharacterPhysicsData) as the character controller's
// options and the pose's speeds. Pure: no engine, no three.js.
//
//   controllerOptions(row, pose = 'stand') → { radius, halfHeight, step: { height, minWidth },
//     slope: { climb, slide }, snap, gravity, mass }   (createCharacter's keys)
//   speedFor(row, { pose, sprint, dir: { x, y }, wading, air }) → m/s   dir: y forward, x right
//   accelFor(row, pose, want, have, dt, { air }) → the next { x, z } velocity
//   poseFor(row, state, want, t) → { pose, next, until }   (a pose change takes its transition time)
//   slideOn(row, normal) → boolean   (the ground under you steeper than the slide angle)
//   eyeFor(row, pose) → [x, y, z]
//   jumpSpeed(row, gravity) → m/s
//
// The capsule: Rapier's `halfHeight` is the cylinder's half-length, so a
// pose's height h with radius r is (h − 2r) / 2 (stand 1.7 → 0.55, crouch
// 1.15 → 0.275). The walk is OnGroundStateData's rows (in the air,
// InAirStateData's); the snap is how far the game hugs the ground before
// it falls with gravity (FallWithGravityDistanceFromGround).
//
// The gains: the data says AccelerationGain 0.4 and DecelerationGain −15
// and not their unit. The site reads a gain as the fraction of the gap to
// the wanted speed closed in one 30 Hz frame, by its magnitude, never more
// than the whole gap: 0.4 closes 90% in about a sixth of a second, −15 the
// whole gap within a substep (a stop, never a reversal). The gravity is the
// level's in the game, not the record's: the site's 15.5 (CHARACTER's),
// with the record's jump height honoured under it (NOTES.md).

export const GRAVITY = 15.5;
const FRAME = 30;
const RAD = Math.PI / 180;
const POSES = ['stand', 'crouch', 'prone'];

const poseRow = (row, pose) => row.poses?.[pose] ?? row.poses?.stand ?? {};
// a state's pose row: the pose's own, else the stand's
function infoOf(row, state, pose) {
  const s = row.states?.[state]?.poses;
  return s?.[pose] ?? s?.stand ?? null;
}

export function controllerOptions(row, pose = 'stand') {
  const radius = row.radius ?? 0.3;
  const p = poseRow(row, pose);
  const height = p.height ?? 1.7;
  return {
    radius,
    halfHeight: Math.max(0.01, (height - 2 * radius) / 2),
    step: { height: p.step ?? 0.35, minWidth: 0.2 },
    slope: { climb: row.ascend ?? 45, slide: row.slide ?? 45 },
    snap: row.states?.onGround?.fallWithGravityDistanceFromGround ?? 0.3,
    gravity: GRAVITY,
    mass: row.mass ?? 100,
  };
}

// the speed for a stick: forward × forward, back × back, strafe × left or
// right, the sprint (forward only) when the pose sprints, wading × water
export function speedFor(row, { pose = 'stand', sprint = false, dir = { x: 0, y: 1 }, wading = false, air = false } = {}) {
  const info = infoOf(row, air ? 'inAir' : 'onGround', pose);
  if (!info) return 0;
  const len = Math.hypot(dir.x, dir.y);
  if (!(len > 1e-6)) return 0;
  const x = dir.x / len;
  const y = dir.y / len;
  const fy = y >= 0 ? (info.forward ?? 1) : (info.back ?? 1);
  const fx = x >= 0 ? (info.right ?? 1) : (info.left ?? 1);
  let v = (info.velocity ?? 0) * Math.hypot(x * fx, y * fy) * Math.min(1, len);
  if (sprint && y > 0 && info.sprintGain > 0 && info.sprintMultiplier > 0) v *= info.sprintMultiplier;
  if (wading && info.water > 0) v *= info.water;
  return v;
}

// the next velocity toward `want`: the acceleration gain when speeding up,
// the deceleration's when slowing, the step never past the wanted speed
export function accelFor(row, pose, want, have, dt, { air = false } = {}) {
  const info = infoOf(row, air ? 'inAir' : 'onGround', pose);
  const slowing = Math.hypot(want.x, want.z) < Math.hypot(have.x, have.z) - 1e-6;
  const gain = Math.abs((slowing ? info?.decelGain : info?.accelGain) ?? 1);
  const k = Math.min(1, gain * FRAME * dt);
  const out = { x: have.x + (want.x - have.x) * k, z: have.z + (want.z - have.z) * k };
  if (Math.abs(out.x) < 1e-4 && want.x === 0) out.x = 0;
  if (Math.abs(out.z) < 1e-4 && want.z === 0) out.z = 0;
  return out;
}

// a pose change: the wanted pose arrives after the current pose's
// transition time to it; until then the pose stays as it was
export function poseFor(row, state, want, t) {
  const now = state ?? { pose: 'stand', next: null, until: 0 };
  if (!POSES.includes(want) || !row.poses?.[want]) want = now.next ?? now.pose;
  if (now.next && t >= now.until) return poseFor(row, { pose: now.next, next: null, until: 0 }, want, t);
  if (want === (now.next ?? now.pose)) return now;
  if (want === now.pose) return { pose: now.pose, next: null, until: 0 };
  const time = poseRow(row, now.pose).transitions?.[want] ?? 0;
  if (!(time > 0)) return { pose: want, next: null, until: 0 };
  return { pose: now.pose, next: want, until: t + time };
}

// the ground's normal steeper than the slide angle
export function slideOn(row, normal) {
  const len = Math.hypot(normal[0], normal[1], normal[2]);
  if (!(len > 0)) return false;
  return Math.acos(Math.min(1, Math.max(-1, normal[1] / len))) > (row.slide ?? 45) * RAD;
}

export function eyeFor(row, pose = 'stand') {
  const e = poseRow(row, pose).eye;
  return e ? [...e] : [0, 1.55, 0];
}

// the record's jump height under the site's gravity, else its hand fallback
export function jumpSpeed(row, gravity = GRAVITY) {
  const jump = row.states?.jump;
  const h = jump?.jumpHeight;
  if (h > 0) return Math.sqrt(2 * gravity * h);
  return jump?.fallback?.speed ?? 5.4;
}
