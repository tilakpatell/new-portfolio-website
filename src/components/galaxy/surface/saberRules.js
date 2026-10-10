// A lightsaber's rules that aren't a stroke's, as plain numbers: where a
// thrown blade is as it flies out and comes back (a bolt the raised blade
// turns is the blade's own segment against the bolt's: lib/combat/bolt.js). Pure, so it's tested in Node; saber.js draws the saber and
// surface/scene.js runs these on it. The strokes are clips now
// (combatRules.js's stance table) and what they hit is the blade's sweep
// (lib/combat/blade.js).
//
//   SABER            { combo (seconds after a stroke ends in which the next continues the combo), throw }
//   BLOCK_AT         of the block clip, where the raised blade is held (the frame saber.js lays; a 2017 block's side is
//                    read there: scripts/lib/bf2017-strokes.mjs's HELD)
//   throwAt(k)       a thrown blade `k` (0…1) of the way through its flight: { d (metres out along the throw), spin (radians), back (true on the way back) }
//   BLADE_OF[hilt]   a 2017 hilt's blade (catalog/bf2017.js's kinds): { base: [x, y, z] (its emitter, metres in the hilt's
//                    frame, the blade up +y), base2? (a staff's other end), length, radius (the game's rod's) }, measured
//                    from the game's models (scripts/bf2017-strokes.mjs --blade: src/data/bf2017/blades.json)

import BLADES from '../../../data/bf2017/blades.json';

export const SABER = {
  combo: 0.45, // seconds after a stroke ends in which the next continues the combo
  throw: { range: 16, dur: 1.5, damage: 2, radius: 1.3, spins: 7 },
};

export const BLOCK_AT = 0.32; // of the block clip, where it's held: the blade up across

export const BLADE_OF = BLADES.hilts;

export function throwAt(k) {
  const x = Math.max(0, Math.min(1, k));
  // out fast, a hang at the far end, and back: a raised cosine
  const d = (SABER.throw.range * (1 - Math.cos(x * Math.PI * 2))) / 2;
  return { d, spin: x * Math.PI * 2 * SABER.throw.spins, back: x > 0.5 };
}
