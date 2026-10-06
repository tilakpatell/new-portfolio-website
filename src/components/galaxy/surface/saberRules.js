// A lightsaber's rules, as plain numbers: the swings of its combo (an arc
// of the arm, where the blade goes and how long it takes), what a swing
// reaches, where a thrown blade is as it flies out and comes back, and
// which bolts a raised blade turns away. Pure, so it's tested in Node;
// saber.js draws the saber and surface/scene.js runs these on it.
//
//   SWINGS           the combo's arcs, in order: { dur, yaw: [from, to], pitch: [from, to], lead }
//   swingPose(i, k)  where the arm points `k` (0…1) through swing i: { yaw, pitch } (radians from the facing, + left and up)
//   nextSwing(last, now)  the swing to make now: the next of the combo if the last ended within COMBO seconds, else the first
//   arcHit(me, t, reach, half)  whether t ({ x, z }) is within a swing's reach of me ({ x, z, yaw }), inside `half` radians of the facing
//   throwAt(k)       a thrown blade `k` (0…1) of the way through its flight: { d (metres out along the throw), spin (radians), back (true on the way back) }
//   deflects(me, from, cone)  whether a bolt from `from` ([x, y, z]) comes at me ({ x, z, yaw }) from inside the raised blade's cone

export const SABER = {
  reach: 2.5, // metres a swing reaches
  half: 1.1, // radians either side of the facing it covers
  damage: 2, // hits a swing is worth (a stormtrooper has one or two)
  combo: 0.45, // seconds after a swing ends in which the next continues the combo
  throw: { range: 16, dur: 1.5, damage: 2, radius: 1.3, spins: 7 },
  block: { cone: 1.15 }, // radians either side of the facing the raised blade covers
};

export const SWINGS = [
  { dur: 0.38, yaw: [-1.25, 1.15], pitch: [0.35, -0.25], lead: 0.5 }, // right to left, a touch downward
  { dur: 0.38, yaw: [1.2, -1.2], pitch: [-0.15, 0.3], lead: 0.5 }, // back the other way, rising
  { dur: 0.46, yaw: [0.25, -0.2], pitch: [1.25, -0.75], lead: 0.55 }, // overhead, down
];

const ease = (k) => k * k * (3 - 2 * k);

export function swingPose(i, k) {
  const s = SWINGS[i % SWINGS.length];
  const e = ease(Math.max(0, Math.min(1, k)));
  // (mixed, not stepped from the start, so the end comes out exact)
  return { yaw: s.yaw[0] * (1 - e) + s.yaw[1] * e, pitch: s.pitch[0] * (1 - e) + s.pitch[1] * e };
}

// last: { i, endedAt } or null
export function nextSwing(last, now) {
  if (!last || now - last.endedAt > SABER.combo) return 0;
  return (last.i + 1) % SWINGS.length;
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function arcHit(me, t, reach = SABER.reach, half = SABER.half) {
  const dx = t.x - me.x;
  const dz = t.z - me.z;
  const d = Math.hypot(dx, dz);
  if (d > reach + (t.r ?? 0)) return false;
  if (d < 1e-6) return true;
  return Math.abs(wrap(Math.atan2(dx, dz) - me.yaw)) <= half;
}

export function throwAt(k) {
  const x = Math.max(0, Math.min(1, k));
  // out fast, a hang at the far end, and back: a raised cosine
  const d = (SABER.throw.range * (1 - Math.cos(x * Math.PI * 2))) / 2;
  return { d, spin: x * Math.PI * 2 * SABER.throw.spins, back: x > 0.5 };
}

export function deflects(me, from, cone = SABER.block.cone) {
  const dx = from[0] - me.x;
  const dz = from[2] - me.z;
  if (dx * dx + dz * dz < 1e-6) return true;
  return Math.abs(wrap(Math.atan2(dx, dz) - me.yaw)) <= cone;
}
