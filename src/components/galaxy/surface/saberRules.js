// A lightsaber's rules that aren't a stroke's, as plain numbers: where a
// thrown blade is as it flies out and comes back, and which bolts a raised
// blade turns away (until the bolts themselves are swept against the
// blade). Pure, so it's tested in Node; saber.js draws the saber and
// surface/scene.js runs these on it. The strokes are clips now
// (combatRules.js's stance table) and what they hit is the blade's sweep
// (lib/combat/blade.js).
//
//   SABER            { combo (seconds after a stroke ends in which the next continues the combo), throw, block }
//   throwAt(k)       a thrown blade `k` (0…1) of the way through its flight: { d (metres out along the throw), spin (radians), back (true on the way back) }
//   deflects(me, from, cone)  whether a bolt from `from` ([x, y, z]) comes at me ({ x, z, yaw }) from inside the raised blade's cone

export const SABER = {
  combo: 0.45, // seconds after a stroke ends in which the next continues the combo
  throw: { range: 16, dur: 1.5, damage: 2, radius: 1.3, spins: 7 },
  block: { cone: 1.15 }, // radians either side of the facing the raised blade covers
};

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
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
