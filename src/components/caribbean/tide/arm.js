// A kraken's arm as a chain, not a pole: ten lengths from where it leaves
// the water to its tip, each turned on the one below it, so it bends.
// Raised, it stands in an S with its tip hooked over; drawn back before a
// blow, the hook tightens; brought down, the base swings first and the rest
// follows it over, the tip last and whipping past before it settles, laid
// along the water with the tip in it; struck, it recoils. Each joint is a
// spring toward where the pose wants it, stiffer at the base than the tip
// (that difference is the follow-through), with a slow writhe running up it
// on a clock of its own. ./Tide3D.js bends the tentacle's mesh along the
// angles this gives. Pure: no three.js, no Math.random.
//
//   ARM_JOINTS: the lengths in the chain
//   createArm({ seed, writhe }) → { step(dt, { fall, curl, droop, t }) →
//     { base, a, b }, flinch(power) }
//     fall: how far over the whole arm is (radians, + toward where it
//     strikes, as rules.js and Tide3D.js have had it: −0.22 drawn back, 1.45
//     down on the water); curl: the hook at its tip (0…1, a little over for
//     a tighter one); droop: laid on the water (0…1), the end bent down into
//     it; t: the sea's clock, for the writhe
//     base: the turn where it leaves the water (radians, + toward the
//     strike); a[i]: joint i's angle in the arm's plane, from the base's
//     (a[0] = 0, a[ARM_JOINTS] the tip's), + the same way; b[i]: its angle
//     out of that plane, sideways
//   writhe: how much it moves on its own (1; 0 for none)

import { seeded } from '../../../lib/seeded';

export const ARM_JOINTS = 10;
const N = ARM_JOINTS;
const BASE = 0.55; // of a fall, taken at the base; the rest along the arm, more toward the tip
const W0 = 18; // the base's spring (rad/s); each joint up is slower
const SLOW = 0.2; // a joint's spring is W0 / (1 + SLOW · i)
const DAMP_BASE = 0.85;
const DAMP = 0.5; // under-damped up the arm: the tip whips past and comes back
const SUB = 1 / 120; // the longest step the springs take

// how the bend is shared out along the arm, joint by joint (1…N)
const total = (N * (N + 1)) / 2;
const SHARE = Array.from({ length: N + 1 }, (_, j) => (j ? j / total : 0));
// the hook at the tip, and a small curve the other way low down (an S)
const HOOK = Array.from({ length: N + 1 }, (_, j) => (j >= N - 3 ? [0.1, 0.2, 0.3, 0.42][j - (N - 3)] : j >= 2 && j <= 4 ? -0.04 : 0));
// laid on the water: the end half bent on down into it
const DROOP = Array.from({ length: N + 1 }, (_, j) => (j > N / 2 ? 0.04 + (0.12 * (j - N / 2 - 1)) / (N / 2 - 1) : 0));

export function createArm({ seed = 1, writhe = 1 } = {}) {
  const r = seeded(seed);
  const ph = r() * 6.283;
  const ph2 = r() * 6.283;
  const pace = 0.85 + r() * 0.3;
  // absolute angles (from upright, in the arm's plane) and their speeds: the base's at 0, each joint's after
  const th = new Float64Array(N + 1);
  const tv = new Float64Array(N + 1);
  const si = new Float64Array(N + 1); // sideways, the same
  const sv = new Float64Array(N + 1);
  const want = new Float64Array(N + 1);
  const side = new Float64Array(N + 1);
  const out = { base: 0, a: new Float32Array(N + 1), b: new Float32Array(N + 1) };
  return {
    step(dt, { fall = 0, curl = 0, droop = 0, t = 0 } = {}) {
      const d = dt > 0 ? Math.min(dt, 0.1) : 0;
      // where the pose wants each joint
      want[0] = BASE * fall;
      side[0] = 0;
      for (let j = 1; j <= N; j++) {
        const up = j / N;
        const wave = writhe * 0.05 * up * Math.sin(t * 2.1 * pace + ph - j * 0.55);
        want[j] = want[j - 1] + (1 - BASE) * fall * SHARE[j] + curl * HOOK[j] + droop * DROOP[j] + wave;
        side[j] = side[j - 1] + writhe * 0.045 * up * Math.sin(t * 1.7 * pace + ph2 - j * 0.5);
      }
      // the springs, in steps short enough to stay put
      const n = Math.ceil(d / SUB);
      const h = n ? d / n : 0;
      for (let k = 0; k < n; k++)
        for (let j = 0; j <= N; j++) {
          const w = W0 / (1 + SLOW * j);
          const c = 2 * (j ? DAMP : DAMP_BASE) * w;
          tv[j] += (w * w * (want[j] - th[j]) - c * tv[j]) * h;
          th[j] += tv[j] * h;
          sv[j] += (w * w * (side[j] - si[j]) - c * sv[j]) * h;
          si[j] += sv[j] * h;
        }
      out.base = th[0];
      for (let j = 0; j <= N; j++) {
        out.a[j] = j ? th[j] - th[0] : 0;
        out.b[j] = si[j];
      }
      return out;
    },
    // struck: thrown back, the tip most
    flinch(power = 1) {
      for (let j = 0; j <= N; j++) tv[j] -= power * (1.5 + (2.5 * j) / N);
    },
  };
}
